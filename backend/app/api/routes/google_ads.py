"""
ZAFESYS Suite - Google Ads API Routes
OAuth 2.0 integration for Google Ads account management.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from app.config import settings
from app.api.deps import get_db  # Use consistent import
from app.models.google_ads_account import GoogleAdsAccount

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Log module load
logger.info("=" * 50)
logger.info("Google Ads routes module LOADED successfully")
logger.info(f"GOOGLE_ADS_CLIENT_ID configured: {bool(settings.GOOGLE_ADS_CLIENT_ID)}")
logger.info(f"GOOGLE_ADS_REDIRECT_URI: {settings.GOOGLE_ADS_REDIRECT_URI}")
logger.info("=" * 50)

router = APIRouter()

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Google Ads API scope
GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords email profile"

# Frontend URL for redirects - use env var or default
FRONTEND_URL = "https://zafesys-suite.vercel.app"


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
    logger.info("GET /google-ads/status called")
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
    logger.info(f"GET /google-ads/auth called for account {account}")

    if not settings.GOOGLE_ADS_CLIENT_ID or not settings.GOOGLE_ADS_REDIRECT_URI:
        logger.error("Google Ads OAuth not configured!")
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
    logger.info(f"Generated auth URL (first 100 chars): {auth_url[:100]}...")

    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    OAuth callback from Google.
    Exchanges authorization code for tokens and saves account info.
    """
    # Log everything about the incoming request
    logger.info("=" * 60)
    logger.info("GOOGLE ADS CALLBACK RECEIVED!")
    logger.info(f"Full URL: {request.url}")
    logger.info(f"Query params: {dict(request.query_params)}")
    logger.info(f"Code present: {bool(code)}")
    logger.info(f"State: {state}")
    logger.info(f"Error: {error}")
    logger.info(f"Error description: {error_description}")
    logger.info("=" * 60)

    # Frontend redirect URL
    frontend_redirect = f"{FRONTEND_URL}/google-ads"

    if error:
        logger.error(f"OAuth error from Google: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error={error}")

    if not code:
        logger.error("No authorization code received")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=no_code")

    if not state:
        logger.error("No state parameter received")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=no_state")

    try:
        account_slot = int(state)
        if account_slot not in [1, 2]:
            raise ValueError("Invalid account slot")
        logger.info(f"Parsed account slot: {account_slot}")
    except ValueError as e:
        logger.error(f"Invalid state parameter: {state} - {e}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=invalid_state")

    try:
        logger.info("Exchanging code for tokens...")

        # Exchange code for tokens
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_data = {
                "code": code,
                "client_id": settings.GOOGLE_ADS_CLIENT_ID,
                "client_secret": settings.GOOGLE_ADS_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_ADS_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
            logger.info(f"Token request to: {GOOGLE_TOKEN_URL}")
            logger.info(f"Redirect URI in request: {settings.GOOGLE_ADS_REDIRECT_URI}")

            token_response = await client.post(GOOGLE_TOKEN_URL, data=token_data)

            logger.info(f"Token response status: {token_response.status_code}")
            logger.info(f"Token response body: {token_response.text[:500]}")

            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                return RedirectResponse(url=f"{frontend_redirect}?oauth_error=token_exchange_failed")

            tokens = token_response.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)

            logger.info(f"Got access token: {bool(access_token)}")
            logger.info(f"Got refresh token: {bool(refresh_token)}")
            logger.info(f"Expires in: {expires_in} seconds")

            # Get user info
            logger.info("Fetching user info...")
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            logger.info(f"Userinfo response status: {userinfo_response.status_code}")

            user_email = None
            if userinfo_response.status_code == 200:
                userinfo = userinfo_response.json()
                user_email = userinfo.get("email")
                logger.info(f"Got user email: {user_email}")
            else:
                logger.warning(f"Failed to get user info: {userinfo_response.text}")

        # Save to database
        logger.info(f"Saving to database for slot {account_slot}...")
        account = get_or_create_account(db, account_slot)
        account.access_token = access_token
        account.refresh_token = refresh_token
        account.email = user_email
        account.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        account.connected = True
        account.account_name = f"Cuenta {user_email}" if user_email else f"Cuenta {account_slot}"
        db.commit()

        logger.info(f"SUCCESS! Google Ads account {account_slot} connected: {user_email}")
        logger.info(f"Redirecting to: {frontend_redirect}?oauth_success=true")

        return RedirectResponse(url=f"{frontend_redirect}?oauth_success=true")

    except httpx.TimeoutException as e:
        logger.error(f"Timeout during OAuth: {e}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=timeout")
    except Exception as e:
        logger.exception(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=internal_error")


@router.post("/disconnect")
async def disconnect_account(
    request: DisconnectRequest,
    db: Session = Depends(get_db),
):
    """Disconnect a Google Ads account."""
    logger.info(f"POST /google-ads/disconnect called for account {request.account}")

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
    logger.info(f"GET /google-ads/spend called for account {account}")

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


# ============== METRICS ENDPOINT ==============

class DailySpend(BaseModel):
    date: str
    spend: float
    impressions: int
    clicks: int


class CampaignMetrics(BaseModel):
    campaign_id: str
    campaign_name: str
    spend: float
    impressions: int
    clicks: int
    ctr: float
    cpc: float
    conversions: int


class ROIMetrics(BaseModel):
    total_sales: float
    total_installations: int
    roi_percentage: float
    cost_per_installation: float


class MetricsResponse(BaseModel):
    account: int
    period_start: str
    period_end: str
    # Totals
    total_spend: float
    total_impressions: int
    total_clicks: int
    average_ctr: float
    average_cpc: float
    # Daily breakdown
    daily_spend: list[DailySpend]
    # Campaign breakdown
    campaigns: list[CampaignMetrics]
    # ROI (optional, if we have sales data)
    roi: Optional[ROIMetrics] = None
    # Currency
    currency: str = "COP"


async def refresh_access_token(account: GoogleAdsAccount, db: Session) -> Optional[str]:
    """Refresh the access token using the refresh token."""
    if not account.refresh_token:
        logger.error(f"No refresh token for account {account.account_slot}")
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_ADS_CLIENT_ID,
                    "client_secret": settings.GOOGLE_ADS_CLIENT_SECRET,
                    "refresh_token": account.refresh_token,
                    "grant_type": "refresh_token",
                },
            )

            if response.status_code == 200:
                tokens = response.json()
                account.access_token = tokens.get("access_token")
                expires_in = tokens.get("expires_in", 3600)
                account.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                db.commit()
                logger.info(f"Access token refreshed for account {account.account_slot}")
                return account.access_token
            else:
                logger.error(f"Failed to refresh token: {response.text}")
                return None
    except Exception as e:
        logger.exception(f"Error refreshing token: {e}")
        return None


async def get_valid_access_token(account: GoogleAdsAccount, db: Session) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    if not account.access_token:
        return await refresh_access_token(account, db)

    # Check if token is expired or will expire in next 5 minutes
    if account.expires_at:
        if account.expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
            return await refresh_access_token(account, db)

    return account.access_token


def generate_mock_metrics(account_slot: int, days: int = 30) -> dict:
    """Generate mock metrics data for testing/demo purposes."""
    import random

    today = datetime.now(timezone.utc).date()
    daily_spend = []
    total_spend = 0
    total_impressions = 0
    total_clicks = 0

    for i in range(days):
        date = today - timedelta(days=days - 1 - i)
        # Simulate realistic daily spend between 50k and 200k COP
        spend = random.uniform(50000, 200000)
        impressions = random.randint(1000, 5000)
        clicks = random.randint(50, 300)

        daily_spend.append({
            "date": date.isoformat(),
            "spend": round(spend, 2),
            "impressions": impressions,
            "clicks": clicks,
        })

        total_spend += spend
        total_impressions += impressions
        total_clicks += clicks

    # Generate campaign data
    campaigns = [
        {
            "campaign_id": "campaign_1",
            "campaign_name": "Cerraduras Inteligentes - Búsqueda",
            "spend": round(total_spend * 0.4, 2),
            "impressions": int(total_impressions * 0.35),
            "clicks": int(total_clicks * 0.45),
            "ctr": 0,
            "cpc": 0,
            "conversions": random.randint(10, 30),
        },
        {
            "campaign_id": "campaign_2",
            "campaign_name": "Cerraduras ZAFE - Display",
            "spend": round(total_spend * 0.35, 2),
            "impressions": int(total_impressions * 0.45),
            "clicks": int(total_clicks * 0.30),
            "ctr": 0,
            "cpc": 0,
            "conversions": random.randint(5, 15),
        },
        {
            "campaign_id": "campaign_3",
            "campaign_name": "Remarketing - Visitantes",
            "spend": round(total_spend * 0.25, 2),
            "impressions": int(total_impressions * 0.20),
            "clicks": int(total_clicks * 0.25),
            "ctr": 0,
            "cpc": 0,
            "conversions": random.randint(8, 20),
        },
    ]

    # Calculate CTR and CPC for each campaign
    for campaign in campaigns:
        if campaign["impressions"] > 0:
            campaign["ctr"] = round((campaign["clicks"] / campaign["impressions"]) * 100, 2)
        if campaign["clicks"] > 0:
            campaign["cpc"] = round(campaign["spend"] / campaign["clicks"], 2)

    return {
        "total_spend": round(total_spend, 2),
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "daily_spend": daily_spend,
        "campaigns": campaigns,
    }


@router.get("/metrics", response_model=MetricsResponse)
async def get_google_ads_metrics(
    account: int = Query(..., ge=1, le=2, description="Account slot (1 or 2)"),
    days: int = Query(30, ge=1, le=90, description="Number of days to fetch"),
    db: Session = Depends(get_db),
):
    """
    Get detailed Google Ads metrics for a connected account.
    Includes daily spend, campaign breakdown, and ROI calculation.
    """
    logger.info(f"GET /google-ads/metrics called for account {account}, days={days}")

    account_record = get_or_create_account(db, account)

    if not account_record.connected:
        raise HTTPException(status_code=400, detail="Account not connected")

    # Calculate date range
    today = datetime.now(timezone.utc).date()
    period_end = today
    period_start = today - timedelta(days=days - 1)

    # Try to get real data from Google Ads API
    metrics_data = None

    # Check if we have valid credentials for Google Ads API
    access_token = await get_valid_access_token(account_record, db)

    if access_token and settings.GOOGLE_ADS_DEVELOPER_TOKEN and account_record.customer_id:
        # TODO: Implement actual Google Ads API call here
        # For now, we'll use mock data but the infrastructure is ready
        logger.info("Google Ads API credentials available, but using mock data for now")
        metrics_data = generate_mock_metrics(account, days)
    else:
        # Use mock data for demo/testing
        logger.info("Using mock metrics data (no Google Ads API credentials or customer_id)")
        metrics_data = generate_mock_metrics(account, days)

    # Calculate totals and averages
    total_spend = metrics_data["total_spend"]
    total_impressions = metrics_data["total_impressions"]
    total_clicks = metrics_data["total_clicks"]

    average_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    average_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0

    # Calculate ROI with installation data
    roi_metrics = None
    try:
        from app.models.installation import Installation
        from sqlalchemy import func

        # Get installations in the same period
        installations = db.query(Installation).filter(
            Installation.status == "completada",
            Installation.completed_at >= datetime.combine(period_start, datetime.min.time()),
            Installation.completed_at <= datetime.combine(period_end, datetime.max.time()),
        ).all()

        total_installations = len(installations)
        total_sales = sum(float(inst.total_price) for inst in installations if inst.total_price)

        if total_spend > 0:
            roi_percentage = ((total_sales - total_spend) / total_spend) * 100
            cost_per_installation = total_spend / total_installations if total_installations > 0 else 0

            roi_metrics = ROIMetrics(
                total_sales=round(total_sales, 2),
                total_installations=total_installations,
                roi_percentage=round(roi_percentage, 2),
                cost_per_installation=round(cost_per_installation, 2),
            )
            logger.info(f"ROI calculated: {roi_percentage:.2f}%, {total_installations} installations")
    except Exception as e:
        logger.warning(f"Could not calculate ROI: {e}")

    return MetricsResponse(
        account=account,
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        total_spend=round(total_spend, 2),
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        average_ctr=round(average_ctr, 2),
        average_cpc=round(average_cpc, 2),
        daily_spend=[DailySpend(**d) for d in metrics_data["daily_spend"]],
        campaigns=[CampaignMetrics(**c) for c in metrics_data["campaigns"]],
        roi=roi_metrics,
        currency="COP",
    )


# Log that router was created
logger.info(f"Google Ads router created with {len(router.routes)} routes")
