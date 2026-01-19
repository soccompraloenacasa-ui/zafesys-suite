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
        return True

    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def format_transcript(transcript_data) -> str:
    """Convert transcript from various formats to a readable string."""
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
        messages = transcript_data.get("messages", [])
        return format_transcript(messages)

    return str(transcript_data)


def extract_phone_from_text(text: str) -> str | None:
    """Extract phone number from text using regex."""
    patterns = [
        r'\b3\d{9}\b',
        r'\b\+57\s*3\d{9}\b',
        r'\b57\s*3\d{9}\b',
        r'\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b',
    ]

    for pattern in patterns:
        match = re.search(pattern, text.replace(" ", ""))
        if match:
            phone = re.sub(r'[^\d+]', '', match.group())
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
    patterns = [
        r'(?:mi nombre es|me llamo|soy)\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)',
        r'(?:nombre[:\s]+)([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)',
    ]

    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            name = match.group(1).strip().title()
            if len(name) > 2:
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
    """Calculate interest level based on conversation content."""
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
    """Analyze the conversation to extract customer data."""
    result = {
        "name": None,
        "phone": None,
        "email": None,
        "address": None,
        "product_interest": None,
        "interest_level": "low",
        "notes": None,
    }

    if payload.analysis:
        result["name"] = payload.analysis.customer_name
        result["phone"] = payload.analysis.customer_phone
        result["email"] = payload.analysis.customer_email
        result["address"] = payload.analysis.customer_address
        result["product_interest"] = payload.analysis.product_interest
        result["interest_level"] = payload.analysis.interest_level or "medium"
        result["notes"] = payload.analysis.summary

    collected = payload.collected_data or payload.data_collection or {}
    if collected:
        result["name"] = result["name"] or collected.get("customer_name") or collected.get("name")
        result["phone"] = result["phone"] or collected.get("customer_phone") or collected.get("phone")
        result["email"] = result["email"] or collected.get("customer_email") or collected.get("email")
        result["address"] = result["address"] or collected.get("customer_address") or collected.get("address")
        result["product_interest"] = result["product_interest"] or collected.get("product_interest") or collected.get("product")

    result["name"] = result["name"] or payload.customer_name
    result["phone"] = result["phone"] or payload.customer_phone
    result["email"] = result["email"] or payload.customer_email
    result["address"] = result["address"] or payload.customer_address
    result["product_interest"] = result["product_interest"] or payload.product_interest
    result["notes"] = result["notes"] or payload.notes

    transcript_text = format_transcript(payload.transcript)

    if transcript_text:
        if not result["phone"]:
            result["phone"] = extract_phone_from_text(transcript_text)

        if not result["name"]:
            result["name"] = extract_name_from_text(transcript_text)

        if not result["product_interest"]:
            result["product_interest"] = detect_product_interest(transcript_text)

        if result["interest_level"] == "low":
            result["interest_level"] = calculate_interest_level(transcript_text)

    return result


# ============================================================
# WEBHOOK ENDPOINTS
# ============================================================

@router.get("/elevenlabs/test-connection")
async def test_connection():
    """Simple endpoint to verify webhook route exists."""
    logger.info("=== TEST CONNECTION CALLED ===")
    return {"status": "ok", "message": "Webhook endpoint is reachable"}


@router.post("/elevenlabs/conversation")
async def elevenlabs_conversation_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Webhook endpoint for ElevenLabs conversation data.
    """
    # === LOG EVERYTHING ===
    logger.info("=" * 60)
    logger.info("=== ELEVENLABS WEBHOOK RECEIVED ===")
    logger.info("=" * 60)

    # Log headers
    headers_dict = dict(request.headers)
    logger.info(f"Headers: {json.dumps(headers_dict, indent=2)}")

    # Log body
    body = await request.body()
    body_str = body.decode('utf-8', errors='replace')
    logger.info(f"Body length: {len(body_str)} bytes")
    logger.info(f"Body: {body_str[:2000]}...")  # First 2000 chars

    # Log query params
    logger.info(f"Query params: {dict(request.query_params)}")
    logger.info(f"URL: {request.url}")
    logger.info(f"Method: {request.method}")

    # === TEMPORARILY SKIP SIGNATURE VALIDATION ===
    # TODO: Re-enable after debugging
    logger.info("SIGNATURE VALIDATION SKIPPED FOR DEBUGGING")

    # Parse payload
    try:
        data = json.loads(body)
        logger.info(f"Parsed JSON keys: {list(data.keys())}")
        payload = ElevenLabsWebhookPayload(**data)
        logger.info(f"Conversation ID: {payload.conversation_id}")
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        logger.error(f"Raw body was: {body_str[:500]}")
        # Return 200 anyway to acknowledge receipt
        return {"status": "error", "message": f"Parse error: {str(e)}", "received": True}

    # Check if conversation already processed
    existing = crud.lead.get_by_elevenlabs_conversation(
        db, conversation_id=payload.conversation_id
    )
    if existing:
        logger.info(f"Conversation {payload.conversation_id} already processed, lead ID: {existing.id}")
        return {"status": "duplicate", "lead_id": existing.id}

    # Analyze conversation
    analysis = analyze_conversation(payload)
    transcript_text = format_transcript(payload.transcript)

    logger.info(f"Analysis result: {analysis}")

    # Check if we have minimum required data
    if not analysis["phone"] and not analysis["name"]:
        logger.warning(f"No customer data extracted from conversation {payload.conversation_id}")
        analysis["name"] = "Cliente sin identificar"
        analysis["phone"] = f"pendiente-{payload.conversation_id[:8]}"

    # Check if lead with this phone already exists
    if analysis["phone"] and not analysis["phone"].startswith("pendiente"):
        existing_phone = crud.lead.get_by_phone(db, phone=analysis["phone"])
        if existing_phone:
            logger.info(f"Updating existing lead {existing_phone.id} with conversation data")
            existing_phone.elevenlabs_conversation_id = payload.conversation_id
            existing_phone.conversation_transcript = transcript_text
            if analysis["product_interest"]:
                existing_phone.product_interest = analysis["product_interest"]
            if analysis["notes"]:
                existing_phone.notes = (existing_phone.notes or "") + f"\n[Ana] {analysis['notes']}"
            if analysis["interest_level"] == "high" and existing_phone.status == LeadStatus.NUEVO:
                existing_phone.status = LeadStatus.POTENCIAL
            db.add(existing_phone)
            db.commit()
            db.refresh(existing_phone)
            return {"status": "updated", "lead_id": existing_phone.id}

    # Determine lead status
    has_contact = bool(analysis["phone"] and not analysis["phone"].startswith("pendiente"))
    lead_status = determine_lead_status(analysis["interest_level"], has_contact)

    # Create new lead
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
    logger.info("=" * 60)

    return {"status": "created", "lead_id": lead.id}


@router.post("/elevenlabs/test")
async def test_elevenlabs_webhook(
    db: Session = Depends(get_db)
):
    """Test endpoint to simulate ElevenLabs webhook."""
    import uuid

    lead = crud.lead.create_from_elevenlabs(
        db,
        conversation_id=f"test-{uuid.uuid4()}",
        name="Cliente de Prueba",
        phone="+573001234567",
        email="test@example.com",
        address="Calle 123 #45-67, Bogota",
        product_interest="OS566F",
        transcript="Ana: Hola, bienvenido a ZAFESYS.\nCliente: Hola, quiero información sobre cerraduras.",
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
        "status": "ready",
        "signature_validation": "DISABLED FOR DEBUGGING"
    }
