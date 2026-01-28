"""
ZAFESYS Suite - Google Ads API Routes
OAuth 2.0 integration for Google Ads account management.
Uses REAL Google Ads API - NO mock data.
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
from app.api.deps import get_db
from app.models.google_ads_account import GoogleAdsAccount

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Log module load
logger.info("=" * 50)
logger.info("Google Ads routes module LOADED successfully")
logger.info(f"GOOGLE_ADS_CLIENT_ID configured: {bool(settings.GOOGLE_ADS_CLIENT_ID)}")
logger.info(f"GOOGLE_ADS_DEVELOPER_TOKEN configured: {bool(settings.GOOGLE_ADS_DEVELOPER_TOKEN)}")
logger.info("=" * 50)

router = APIRouter()

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Google Ads API
GOOGLE_ADS_API_VERSION = "v17"
GOOGLE_ADS_BASE_URL = f"https://googleads.googleapis.com/{GOOGLE_ADS_API_VERSION}"

# Google Ads API scope
GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords email profile"

# Frontend URL for redirects
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
    account: int


class SpendSummaryResponse(BaseModel):
    account: int
    customer_id: str
    account_name: str
    total_spend: float
    spend_this_month: float
    spend_last_7_days: float
    currency: str


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
    total_spend: float
    total_impressions: int
    total_clicks: int
    average_ctr: float
    average_cpc: float
    daily_spend: list[DailySpend]
    campaigns: list[CampaignMetrics]
    roi: Optional[ROIMetrics] = None
    currency: str = "COP"
    has_data: bool = True
    message: Optional[str] = None


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

    if account.expires_at:
        if account.expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
            return await refresh_access_token(account, db)

    return account.access_token


async def fetch_accessible_customers(access_token: str) -> list[str]:
    """Fetch list of accessible Google Ads customer IDs."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "developer-token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                },
            )

            logger.info(f"listAccessibleCustomers response: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                # Returns format: {"resourceNames": ["customers/1234567890", ...]}
                resource_names = data.get("resourceNames", [])
                customer_ids = [name.split("/")[-1] for name in resource_names]
                logger.info(f"Found {len(customer_ids)} accessible customers: {customer_ids}")
                return customer_ids
            else:
                logger.error(f"Failed to list customers: {response.text}")
                return []
    except Exception as e:
        logger.exception(f"Error fetching accessible customers: {e}")
        return []


async def execute_google_ads_query(
    access_token: str,
    customer_id: str,
    query: str
) -> list[dict]:
    """Execute a GAQL query against Google Ads API."""
    try:
        # Remove dashes from customer_id if present
        clean_customer_id = customer_id.replace("-", "")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GOOGLE_ADS_BASE_URL}/customers/{clean_customer_id}/googleAds:search",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "developer-token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                    "Content-Type": "application/json",
                },
                json={"query": query},
            )

            logger.info(f"Google Ads query response status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                return data.get("results", [])
            else:
                logger.error(f"Google Ads query failed: {response.text}")
                return []
    except Exception as e:
        logger.exception(f"Error executing Google Ads query: {e}")
        return []


# ============== ENDPOINTS ==============

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
    """Initiate OAuth flow with Google."""
    logger.info(f"GET /google-ads/auth called for account {account}")

    if not settings.GOOGLE_ADS_CLIENT_ID or not settings.GOOGLE_ADS_REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="Google Ads OAuth not configured."
        )

    params = {
        "client_id": settings.GOOGLE_ADS_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_ADS_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_ADS_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": str(account),
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
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
    """OAuth callback from Google."""
    logger.info("=" * 60)
    logger.info("GOOGLE ADS CALLBACK RECEIVED!")
    logger.info(f"Code present: {bool(code)}, State: {state}, Error: {error}")
    logger.info("=" * 60)

    frontend_redirect = f"{FRONTEND_URL}/google-ads"

    if error:
        logger.error(f"OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=missing_params")

    try:
        account_slot = int(state)
        if account_slot not in [1, 2]:
            raise ValueError("Invalid account slot")
    except ValueError:
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=invalid_state")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for tokens
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
                return RedirectResponse(url=f"{frontend_redirect}?oauth_error=token_exchange_failed")

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

        # Fetch accessible Google Ads customers
        customer_ids = await fetch_accessible_customers(access_token)
        customer_id = customer_ids[0] if customer_ids else None

        if customer_id:
            logger.info(f"Using customer ID: {customer_id}")
        else:
            logger.warning("No Google Ads customer found for this account")

        # Save to database
        account = get_or_create_account(db, account_slot)
        account.access_token = access_token
        account.refresh_token = refresh_token
        account.email = user_email
        account.customer_id = customer_id
        account.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        account.connected = True
        account.account_name = f"Cuenta {user_email}" if user_email else f"Cuenta {account_slot}"
        db.commit()

        logger.info(f"SUCCESS! Account {account_slot} connected. Customer ID: {customer_id}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_success=true")

    except Exception as e:
        logger.exception(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"{frontend_redirect}?oauth_error=internal_error")


@router.post("/disconnect")
async def disconnect_account(
    request: DisconnectRequest,
    db: Session = Depends(get_db),
):
    """Disconnect a Google Ads account."""
    if request.account not in [1, 2]:
        raise HTTPException(status_code=400, detail="Account must be 1 or 2")

    account = get_or_create_account(db, request.account)
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
    account: int = Query(..., ge=1, le=2),
    db: Session = Depends(get_db),
):
    """Get spend summary for a connected Google Ads account."""
    account_record = get_or_create_account(db, account)

    if not account_record.connected:
        raise HTTPException(status_code=400, detail="Account not connected")

    return SpendSummaryResponse(
        account=account,
        customer_id=account_record.customer_id or "N/A",
        account_name=account_record.account_name or f"Cuenta {account}",
        total_spend=0.0,
        spend_this_month=0.0,
        spend_last_7_days=0.0,
        currency="COP",
    )


@router.get("/metrics", response_model=MetricsResponse)
async def get_google_ads_metrics(
    account: int = Query(..., ge=1, le=2),
    days: int = Query(None, ge=1, le=365),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """
    Get REAL Google Ads metrics for a connected account.
    Returns empty data if no campaigns or spend.

    Parameters:
    - account: 1 or 2
    - start_date: Start date in YYYY-MM-DD format (optional)
    - end_date: End date in YYYY-MM-DD format (optional)
    - days: Number of days (legacy, used if start_date/end_date not provided)
    """
    logger.info(f"GET /google-ads/metrics called for account {account}, start_date={start_date}, end_date={end_date}, days={days}")

    account_record = get_or_create_account(db, account)

    if not account_record.connected:
        raise HTTPException(status_code=400, detail="Account not connected")

    # Calculate date range
    today = datetime.now(timezone.utc).date()

    if start_date and end_date:
        try:
            period_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            period_end = datetime.strptime(end_date, "%Y-%m-%d").date()

            # Validate date range
            if period_start > period_end:
                raise HTTPException(status_code=400, detail="start_date cannot be after end_date")

            # Max 1 year range
            if (period_end - period_start).days > 365:
                raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")

            # Don't allow future dates
            if period_end > today:
                period_end = today

        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Legacy: use days parameter (default 30)
        days = days or 30
        period_end = today
        period_start = today - timedelta(days=days - 1)

    # Initialize empty response
    daily_spend: list[DailySpend] = []
    campaigns: list[CampaignMetrics] = []
    total_spend = 0.0
    total_impressions = 0
    total_clicks = 0
    has_data = False
    message = None

    # Check if we have valid credentials
    if not account_record.customer_id:
        message = "No hay cuenta de Google Ads vinculada. Reconecta para obtener el Customer ID."
        logger.warning(f"No customer_id for account {account}")
    elif not settings.GOOGLE_ADS_DEVELOPER_TOKEN:
        message = "Developer token no configurado en el servidor."
        logger.error("GOOGLE_ADS_DEVELOPER_TOKEN not configured")
    else:
        # Get valid access token
        access_token = await get_valid_access_token(account_record, db)

        if not access_token:
            message = "No se pudo obtener token de acceso válido. Reconecta la cuenta."
            logger.error("Could not get valid access token")
        else:
            # Fetch REAL data from Google Ads API
            try:
                # Query for daily metrics
                daily_query = f"""
                    SELECT
                        segments.date,
                        metrics.cost_micros,
                        metrics.impressions,
                        metrics.clicks
                    FROM customer
                    WHERE segments.date BETWEEN '{period_start.strftime("%Y-%m-%d")}' AND '{period_end.strftime("%Y-%m-%d")}'
                    ORDER BY segments.date ASC
                """

                daily_results = await execute_google_ads_query(
                    access_token,
                    account_record.customer_id,
                    daily_query
                )

                logger.info(f"Daily query returned {len(daily_results)} results")

                # Process daily results
                for row in daily_results:
                    date_str = row.get("segments", {}).get("date", "")
                    cost_micros = int(row.get("metrics", {}).get("costMicros", 0))
                    impressions = int(row.get("metrics", {}).get("impressions", 0))
                    clicks = int(row.get("metrics", {}).get("clicks", 0))

                    # Convert micros to actual currency (divide by 1,000,000)
                    spend = cost_micros / 1_000_000

                    daily_spend.append(DailySpend(
                        date=date_str,
                        spend=round(spend, 2),
                        impressions=impressions,
                        clicks=clicks
                    ))

                    total_spend += spend
                    total_impressions += impressions
                    total_clicks += clicks
                    has_data = True

                # Query for campaign metrics
                campaign_query = f"""
                    SELECT
                        campaign.id,
                        campaign.name,
                        metrics.cost_micros,
                        metrics.impressions,
                        metrics.clicks,
                        metrics.conversions
                    FROM campaign
                    WHERE segments.date BETWEEN '{period_start.strftime("%Y-%m-%d")}' AND '{period_end.strftime("%Y-%m-%d")}'
                        AND campaign.status = 'ENABLED'
                """

                campaign_results = await execute_google_ads_query(
                    access_token,
                    account_record.customer_id,
                    campaign_query
                )

                logger.info(f"Campaign query returned {len(campaign_results)} results")

                # Process campaign results
                for row in campaign_results:
                    campaign_data = row.get("campaign", {})
                    metrics_data = row.get("metrics", {})

                    campaign_id = str(campaign_data.get("id", ""))
                    campaign_name = campaign_data.get("name", "Sin nombre")
                    cost_micros = int(metrics_data.get("costMicros", 0))
                    impressions = int(metrics_data.get("impressions", 0))
                    clicks = int(metrics_data.get("clicks", 0))
                    conversions = int(float(metrics_data.get("conversions", 0)))

                    spend = cost_micros / 1_000_000
                    ctr = (clicks / impressions * 100) if impressions > 0 else 0
                    cpc = (spend / clicks) if clicks > 0 else 0

                    campaigns.append(CampaignMetrics(
                        campaign_id=campaign_id,
                        campaign_name=campaign_name,
                        spend=round(spend, 2),
                        impressions=impressions,
                        clicks=clicks,
                        ctr=round(ctr, 2),
                        cpc=round(cpc, 2),
                        conversions=conversions
                    ))
                    has_data = True

                if not has_data:
                    message = "No hay datos de gasto en el período seleccionado."

            except Exception as e:
                logger.exception(f"Error fetching Google Ads data: {e}")
                message = f"Error al obtener datos de Google Ads: {str(e)}"

    # Calculate averages
    average_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    average_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0

    # Calculate ROI with installation data
    roi_metrics = None
    if total_spend > 0:
        try:
            from app.models.installation import Installation

            installations = db.query(Installation).filter(
                Installation.status == "completada",
                Installation.completed_at >= datetime.combine(period_start, datetime.min.time()),
                Installation.completed_at <= datetime.combine(period_end, datetime.max.time()),
            ).all()

            total_installations = len(installations)
            total_sales = sum(float(inst.total_price) for inst in installations if inst.total_price)

            roi_percentage = ((total_sales - total_spend) / total_spend) * 100
            cost_per_installation = total_spend / total_installations if total_installations > 0 else 0

            roi_metrics = ROIMetrics(
                total_sales=round(total_sales, 2),
                total_installations=total_installations,
                roi_percentage=round(roi_percentage, 2),
                cost_per_installation=round(cost_per_installation, 2),
            )
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
        daily_spend=daily_spend,
        campaigns=campaigns,
        roi=roi_metrics,
        currency="COP",
        has_data=has_data,
        message=message,
    )


logger.info(f"Google Ads router created with {len(router.routes)} routes")
