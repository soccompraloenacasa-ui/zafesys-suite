"""
ZAFESYS Suite - Webhook Routes
ElevenLabs conversation webhook to create leads automatically
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app import crud
from app.schemas import ElevenLabsWebhookPayload, LeadResponse
from app.models.lead import LeadStatus, LeadSource
from app.config import settings
import hmac
import hashlib
import json
import re
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Keywords for interest level detection
HIGH_INTEREST_KEYWORDS = [
    "quiero comprar", "necesito instalar", "cuánto cuesta", "precio",
    "agendar", "programar instalación", "me interesa", "quiero cotizar",
    "listo para", "puedo pagar", "disponibilidad", "cuando pueden"
]
PRODUCT_KEYWORDS = {
    "os566f": ["os566f", "os 566", "os566", "huella", "biométrica"],
    "os505": ["os505", "os 505", "manija", "básica"],
    "os600": ["os600", "os 600", "premium", "wifi"],
    "cerradura": ["cerradura", "chapa", "lock", "candado"],
}


def verify_elevenlabs_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify ElevenLabs webhook signature."""
    if not secret:
        # If no secret configured, skip verification (dev mode)
        return True

    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def format_transcript(transcript_data) -> str:
    """
    Convert transcript from various formats to a readable string.

    ElevenLabs may send transcript as:
    - A string (simple format)
    - A list of message objects with role/message
    - A nested structure with messages array
    """
    if transcript_data is None:
        return ""

    if isinstance(transcript_data, str):
        return transcript_data

    if isinstance(transcript_data, list):
        lines = []
        for msg in transcript_data:
            if isinstance(msg, dict):
                role = msg.get("role", "unknown")
                message = msg.get("message", msg.get("text", ""))
                speaker = "Ana" if role == "agent" else "Cliente"
                lines.append(f"{speaker}: {message}")
            elif isinstance(msg, str):
                lines.append(msg)
        return "\n".join(lines)

    if isinstance(transcript_data, dict):
        # Handle nested messages array
        messages = transcript_data.get("messages", [])
        return format_transcript(messages)

    return str(transcript_data)


def extract_phone_from_text(text: str) -> str | None:
    """Extract phone number from text using regex."""
    # Colombian phone patterns
    patterns = [
        r'\b3\d{9}\b',  # 3XXXXXXXXX (10 digits starting with 3)
        r'\b\+57\s*3\d{9}\b',  # +57 3XXXXXXXXX
        r'\b57\s*3\d{9}\b',  # 57 3XXXXXXXXX
        r'\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b',  # XXX-XXX-XXXX
    ]

    for pattern in patterns:
        match = re.search(pattern, text.replace(" ", ""))
        if match:
            phone = re.sub(r'[^\d+]', '', match.group())
            # Normalize to +57 format
            if phone.startswith("3") and len(phone) == 10:
                return f"+57{phone}"
            elif phone.startswith("57") and len(phone) == 12:
                return f"+{phone}"
            elif phone.startswith("+57"):
                return phone
            return phone

    return None


def extract_name_from_text(text: str) -> str | None:
    """Try to extract customer name from conversation text."""
    # Look for common patterns
    patterns = [
        r'(?:mi nombre es|me llamo|soy)\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)',
        r'(?:nombre[:\s]+)([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)',
    ]

    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            name = match.group(1).strip().title()
            if len(name) > 2:  # Avoid single letters
                return name

    return None


def detect_product_interest(text: str) -> str | None:
    """Detect which product the customer is interested in."""
    text_lower = text.lower()

    for product, keywords in PRODUCT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return product.upper()

    return None


def calculate_interest_level(text: str) -> str:
    """
    Calculate interest level based on conversation content.
    Returns: "high", "medium", or "low"
    """
    text_lower = text.lower()
    interest_score = 0

    for keyword in HIGH_INTEREST_KEYWORDS:
        if keyword in text_lower:
            interest_score += 1

    if interest_score >= 3:
        return "high"
    elif interest_score >= 1:
        return "medium"
    return "low"


def determine_lead_status(interest_level: str, has_contact_info: bool) -> LeadStatus:
    """Determine initial lead status based on interest and contact info."""
    if interest_level == "high" and has_contact_info:
        return LeadStatus.POTENCIAL
    elif interest_level == "medium" or has_contact_info:
        return LeadStatus.EN_CONVERSACION
    return LeadStatus.NUEVO


def analyze_conversation(payload: ElevenLabsWebhookPayload) -> dict:
    """
    Analyze the conversation to extract customer data.

    Checks multiple sources:
    1. Explicit fields in payload (analysis, collected_data)
    2. Text analysis of transcript
    """
    result = {
        "name": None,
        "phone": None,
        "email": None,
        "address": None,
        "product_interest": None,
        "interest_level": "low",
        "notes": None,
    }

    # 1. Check analysis data from ElevenLabs
    if payload.analysis:
        result["name"] = payload.analysis.customer_name
        result["phone"] = payload.analysis.customer_phone
        result["email"] = payload.analysis.customer_email
        result["address"] = payload.analysis.customer_address
        result["product_interest"] = payload.analysis.product_interest
        result["interest_level"] = payload.analysis.interest_level or "medium"
        result["notes"] = payload.analysis.summary

    # 2. Check collected_data or data_collection
    collected = payload.collected_data or payload.data_collection or {}
    if collected:
        result["name"] = result["name"] or collected.get("customer_name") or collected.get("name")
        result["phone"] = result["phone"] or collected.get("customer_phone") or collected.get("phone")
        result["email"] = result["email"] or collected.get("customer_email") or collected.get("email")
        result["address"] = result["address"] or collected.get("customer_address") or collected.get("address")
        result["product_interest"] = result["product_interest"] or collected.get("product_interest") or collected.get("product")

    # 3. Check direct payload fields
    result["name"] = result["name"] or payload.customer_name
    result["phone"] = result["phone"] or payload.customer_phone
    result["email"] = result["email"] or payload.customer_email
    result["address"] = result["address"] or payload.customer_address
    result["product_interest"] = result["product_interest"] or payload.product_interest
    result["notes"] = result["notes"] or payload.notes

    # 4. Analyze transcript text
    transcript_text = format_transcript(payload.transcript)

    if transcript_text:
        # Extract missing data from text
        if not result["phone"]:
            result["phone"] = extract_phone_from_text(transcript_text)

        if not result["name"]:
            result["name"] = extract_name_from_text(transcript_text)

        if not result["product_interest"]:
            result["product_interest"] = detect_product_interest(transcript_text)

        # Calculate interest level from conversation
        if result["interest_level"] == "low":
            result["interest_level"] = calculate_interest_level(transcript_text)

    return result


@router.post("/elevenlabs/conversation")
async def elevenlabs_conversation_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_elevenlabs_signature: str = Header(default=""),
    x_webhook_secret: str = Header(default=""),
):
    """
    Webhook endpoint for ElevenLabs conversation data.

    When Ana (voice assistant) completes a conversation, ElevenLabs
    sends the conversation data here to create a new lead automatically.

    The webhook:
    1. Verifies the signature (if secret is configured)
    2. Parses the ElevenLabs payload
    3. Analyzes the conversation to extract customer data
    4. Creates or updates a lead with status based on interest level
    """
    # Get raw body for signature verification
    body = await request.body()

    logger.info(f"Received ElevenLabs webhook: {body[:500]}...")

    # Verify signature (if secret is configured)
    signature = x_elevenlabs_signature or x_webhook_secret
    if settings.ELEVENLABS_WEBHOOK_SECRET:
        if not verify_elevenlabs_signature(body, signature, settings.ELEVENLABS_WEBHOOK_SECRET):
            logger.warning("Invalid webhook signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

    # Parse payload
    try:
        data = json.loads(body)
        payload = ElevenLabsWebhookPayload(**data)
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payload: {str(e)}"
        )

    # Check if conversation already processed
    existing = crud.lead.get_by_elevenlabs_conversation(
        db, conversation_id=payload.conversation_id
    )
    if existing:
        logger.info(f"Conversation {payload.conversation_id} already processed, returning existing lead {existing.id}")
        return LeadResponse.model_validate(existing)

    # Analyze conversation
    analysis = analyze_conversation(payload)
    transcript_text = format_transcript(payload.transcript)

    logger.info(f"Conversation analysis: {analysis}")

    # Check if we have minimum required data
    if not analysis["phone"] and not analysis["name"]:
        logger.warning(f"No customer data extracted from conversation {payload.conversation_id}")
        # Still create a lead with placeholder data
        analysis["name"] = "Cliente sin identificar"
        analysis["phone"] = f"pendiente-{payload.conversation_id[:8]}"

    # Check if lead with this phone already exists
    if analysis["phone"] and not analysis["phone"].startswith("pendiente"):
        existing_phone = crud.lead.get_by_phone(db, phone=analysis["phone"])
        if existing_phone:
            # Update existing lead with conversation data
            logger.info(f"Updating existing lead {existing_phone.id} with conversation data")
            existing_phone.elevenlabs_conversation_id = payload.conversation_id
            existing_phone.conversation_transcript = transcript_text
            if analysis["product_interest"]:
                existing_phone.product_interest = analysis["product_interest"]
            if analysis["notes"]:
                existing_phone.notes = (existing_phone.notes or "") + f"\n[Ana] {analysis['notes']}"
            # Update status if interest is high
            if analysis["interest_level"] == "high" and existing_phone.status == LeadStatus.NUEVO:
                existing_phone.status = LeadStatus.POTENCIAL
            db.add(existing_phone)
            db.commit()
            db.refresh(existing_phone)
            return LeadResponse.model_validate(existing_phone)

    # Determine lead status
    has_contact = bool(analysis["phone"] and not analysis["phone"].startswith("pendiente"))
    lead_status = determine_lead_status(analysis["interest_level"], has_contact)

    # Create new lead from conversation
    lead = crud.lead.create_from_elevenlabs(
        db,
        conversation_id=payload.conversation_id,
        name=analysis["name"] or "Cliente de Ana",
        phone=analysis["phone"] or f"pendiente-{payload.conversation_id[:8]}",
        email=analysis["email"],
        address=analysis["address"],
        product_interest=analysis["product_interest"],
        transcript=transcript_text,
        notes=analysis["notes"],
        status=lead_status,
        source=LeadSource.ANA_VOICE,
    )

    logger.info(f"Created new lead {lead.id} from conversation {payload.conversation_id}")

    return LeadResponse.model_validate(lead)


@router.post("/elevenlabs/test")
async def test_elevenlabs_webhook(
    db: Session = Depends(get_db)
):
    """
    Test endpoint to simulate ElevenLabs webhook.
    Creates a sample lead from a mock conversation.
    """
    import uuid

    # Create a test lead
    lead = crud.lead.create_from_elevenlabs(
        db,
        conversation_id=f"test-{uuid.uuid4()}",
        name="Cliente de Prueba",
        phone="+573001234567",
        email="test@example.com",
        address="Calle 123 #45-67, Bogota",
        product_interest="OS566F",
        transcript="Ana: Hola, bienvenido a ZAFESYS. Soy Ana, tu asistente virtual.\nCliente: Hola, quiero información sobre cerraduras biométricas.\nAna: Excelente, tenemos el modelo OS566F con sensor de huella. ¿Te gustaría agendar una instalación?\nCliente: Sí, me interesa. Mi nombre es Juan Pérez.\nAna: Perfecto Juan, ¿me puedes dar tu número de teléfono?",
        notes="Lead creado desde webhook de prueba",
        status=LeadStatus.POTENCIAL,
        source=LeadSource.ANA_VOICE,
    )

    return {
        "message": "Test lead created",
        "lead_id": lead.id,
        "lead_name": lead.name,
        "lead_status": lead.status.value
    }


@router.get("/elevenlabs/status")
async def elevenlabs_webhook_status():
    """Check webhook configuration status."""
    return {
        "webhook_url": "/api/v1/webhooks/elevenlabs/conversation",
        "secret_configured": bool(settings.ELEVENLABS_WEBHOOK_SECRET),
        "agent_id_configured": bool(settings.ELEVENLABS_AGENT_ID),
        "status": "ready"
    }
