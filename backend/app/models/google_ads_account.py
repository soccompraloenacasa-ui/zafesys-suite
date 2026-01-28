"""
ZAFESYS Suite - Google Ads Account Model
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class GoogleAdsAccount(Base):
    """Model for storing Google Ads account connections."""
    __tablename__ = "google_ads_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_slot = Column(Integer, nullable=False)  # 1 or 2
    customer_id = Column(String(20), nullable=True)  # Google Ads Customer ID (format: 123-456-7890)
    account_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    connected = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<GoogleAdsAccount(slot={self.account_slot}, email={self.email}, connected={self.connected})>"
