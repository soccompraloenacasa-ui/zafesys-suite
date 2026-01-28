"""
ZAFESYS Suite - Google Ads API Routes
OAuth 2.0 integration for Google Ads account management.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from app.config import settings
from app.database import get_db
from app.models.google_ads_account import GoogleAdsAccount

logger = logging.getLogger(__name__)

router = APIRouter()

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Google Ads API scope
GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords email profile"


# Pydantic models for request/response
class GoogleAdsAccountStatus(BaseModel):
    connected: bool
    email: Optional[str] = None
    customer_id: Optional[str] = None
    account_name: Optional[str] = None


class GoogleAdsStatusResponse(BaseModel):
    account1: GoogleAdsAccountStatus
    account2: GoogleAdsAccountStatus


class DisconnectRequest(BaseModel):
    account: int  # 1 or 2


class SpendSummaryResponse(BaseModel):
    account: int
    customer_id: str
    account_name: str
    total_spend: float
    spend_this_month: float
    spend_last_7_days: float
    currency: str


def get_or_create_account(db: Session, slot: int) -> GoogleAdsAccount:
    """Get or create a Google Ads account record for the given slot."""
    account = db.query(GoogleAdsAccount).filter(
        GoogleAdsAccount.account_slot == slot
    ).first()

    if not account:
        account = GoogleAdsAccount(account_slot=slot, connected=False)
        db.add(account)
        db.commit()
        db.refresh(account)

    return account


@router.get("/status", response_model=GoogleAdsStatusResponse)
async def get_google_ads_status(db: Session = Depends(get_db)):
    """Get connection status of both Google Ads accounts."""
    account1 = get_or_create_account(db, 1)
    account2 = get_or_create_account(db, 2)

    return GoogleAdsStatusResponse(
        account1=GoogleAdsAccountStatus(
            connected=account1.connected,
            email=account1.email,
            customer_id=account1.customer_id,
            account_name=account1.account_name,
        ),
        account2=GoogleAdsAccountStatus(
            connected=account2.connected,
            email=account2.email,
            customer_id=account2.customer_id,
            account_name=account2.account_name,
        ),
    )


@router.get("/auth")
async def initiate_oauth(
    account: int = Query(..., ge=1, le=2, description="Account slot (1 or 2)"),
):
    """
    Initiate OAuth flow with Google.
    Returns the authorization URL to redirect the user to.
    """
    if not settings.GOOGLE_ADS_CLIENT_ID or not settings.GOOGLE_ADS_REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="Google Ads OAuth not configured. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_REDIRECT_URI."
        )

    # Build OAuth URL with state containing account slot
    params = {
        "client_id": settings.GOOGLE_ADS_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_ADS_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_ADS_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": str(account),  # Pass account slot in state
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    OAuth callback from Google.
    Exchanges authorization code for tokens and saves account info.
    """
    # Frontend redirect URL
    frontend_url = "https://zafesys-suite.vercel.app/google-ads"

    if error:
        logger.error(f"OAuth error: {error}")
        return RedirectResponse(url=f"{frontend_url}?oauth_error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}?oauth_error=missing_params")

    try:
        account_slot = int(state)
        if account_slot not in [1, 2]:
            raise ValueError("Invalid account slot")
    except ValueError:
        return RedirectResponse(url=f"{frontend_url}?oauth_error=invalid_state")

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_ADS_CLIENT_ID,
                    "client_secret": settings.GOOGLE_ADS_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_ADS_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                return RedirectResponse(url=f"{frontend_url}?oauth_error=token_exchange_failed")

            tokens = token_response.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)

            # Get user info
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            user_email = None
            if userinfo_response.status_code == 200:
                userinfo = userinfo_response.json()
                user_email = userinfo.get("email")

        # Save to database
        account = get_or_create_account(db, account_slot)
        account.access_token = access_token
        account.refresh_token = refresh_token
        account.email = user_email
        account.expires_at = datetime.now(timezone.utc).replace(
            second=datetime.now(timezone.utc).second + expires_in
        )
        account.connected = True
        account.account_name = f"Cuenta {user_email}" if user_email else f"Cuenta {account_slot}"
        db.commit()

        logger.info(f"Google Ads account {account_slot} connected: {user_email}")
        return RedirectResponse(url=f"{frontend_url}?oauth_success=true")

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"{frontend_url}?oauth_error=internal_error")


@router.post("/disconnect")
async def disconnect_account(
    request: DisconnectRequest,
    db: Session = Depends(get_db),
):
    """Disconnect a Google Ads account."""
    if request.account not in [1, 2]:
        raise HTTPException(status_code=400, detail="Account must be 1 or 2")

    account = get_or_create_account(db, request.account)

    # Clear account data
    account.access_token = None
    account.refresh_token = None
    account.expires_at = None
    account.email = None
    account.customer_id = None
    account.account_name = None
    account.connected = False
    db.commit()

    logger.info(f"Google Ads account {request.account} disconnected")

    return {"success": True}


@router.get("/spend")
async def get_spend_summary(
    account: int = Query(..., ge=1, le=2, description="Account slot (1 or 2)"),
    db: Session = Depends(get_db),
):
    """
    Get spend summary for a connected Google Ads account.
    Note: This is a placeholder. Actual implementation requires Google Ads API calls.
    """
    account_record = get_or_create_account(db, account)

    if not account_record.connected:
        raise HTTPException(status_code=400, detail="Account not connected")

    # TODO: Implement actual Google Ads API call to get spend data
    # This requires the google-ads library and proper API setup
    # For now, return placeholder data

    return SpendSummaryResponse(
        account=account,
        customer_id=account_record.customer_id or "000-000-0000",
        account_name=account_record.account_name or f"Cuenta {account}",
        total_spend=0.0,  # Placeholder
        spend_this_month=0.0,  # Placeholder
        spend_last_7_days=0.0,  # Placeholder
        currency="USD",
    )
