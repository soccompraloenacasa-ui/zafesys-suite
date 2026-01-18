"""
ZAFESYS Suite - Webhook Routes
ElevenLabs conversation webhook to create leads automatically
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app import crud
from app.schemas import ElevenLabsWebhookPayload, LeadResponse
from app.config import settings
import hmac
import hashlib
import json

router = APIRouter()


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


@router.post("/elevenlabs/conversation", response_model=LeadResponse)
async def elevenlabs_conversation_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_elevenlabs_signature: str = Header(default="")
):
    """
    Webhook endpoint for ElevenLabs conversation data.

    When Ana (voice assistant) completes a conversation, ElevenLabs
    sends the conversation data here to create a new lead automatically.
    """
    # Get raw body for signature verification
    body = await request.body()

    # Verify signature (if secret is configured)
    if settings.ELEVENLABS_WEBHOOK_SECRET:
        if not verify_elevenlabs_signature(body, x_elevenlabs_signature, settings.ELEVENLABS_WEBHOOK_SECRET):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

    # Parse payload
    try:
        data = json.loads(body)
        payload = ElevenLabsWebhookPayload(**data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payload: {str(e)}"
        )

    # Check if conversation already processed
    existing = crud.lead.get_by_elevenlabs_conversation(
        db, conversation_id=payload.conversation_id
    )
    if existing:
        return existing

    # Validate required data
    if not payload.customer_name or not payload.customer_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer name and phone are required"
        )

    # Check if lead with this phone already exists
    existing_phone = crud.lead.get_by_phone(db, phone=payload.customer_phone)
    if existing_phone:
        # Update existing lead with conversation data
        existing_phone.elevenlabs_conversation_id = payload.conversation_id
        existing_phone.conversation_transcript = payload.transcript
        if payload.product_interest:
            existing_phone.product_interest = payload.product_interest
        if payload.notes:
            existing_phone.notes = (existing_phone.notes or "") + f"\n[Ana] {payload.notes}"
        db.add(existing_phone)
        db.commit()
        db.refresh(existing_phone)
        return existing_phone

    # Create new lead from conversation
    lead = crud.lead.create_from_elevenlabs(
        db,
        conversation_id=payload.conversation_id,
        name=payload.customer_name,
        phone=payload.customer_phone,
        email=payload.customer_email,
        address=payload.customer_address,
        product_interest=payload.product_interest,
        transcript=payload.transcript,
        notes=payload.notes
    )

    return lead


@router.post("/elevenlabs/test")
async def test_elevenlabs_webhook(
    db: Session = Depends(get_db)
):
    """
    Test endpoint to simulate ElevenLabs webhook.
    Creates a sample lead from a mock conversation.
    """
    # Create a test lead
    lead = crud.lead.create_from_elevenlabs(
        db,
        conversation_id=f"test-{__import__('uuid').uuid4()}",
        name="Cliente de Prueba",
        phone="+573001234567",
        email="test@example.com",
        address="Calle 123 #45-67, Bogota",
        product_interest="OS566F",
        transcript="Ana: Hola, bienvenido a ZAFESYS. Cliente: Hola, quiero información sobre cerraduras.",
        notes="Lead creado desde webhook de prueba"
    )

    return {
        "message": "Test lead created",
        "lead_id": lead.id,
        "lead_name": lead.name
    }
