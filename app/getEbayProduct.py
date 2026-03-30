import os
from pathlib import Path
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth


BASE_DIR = Path(__file__).resolve().parent
for env_path in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
    if env_path.exists():
        load_dotenv(env_path)
        break


def generateOAuthKey() -> str:
    url = os.getenv("EBAY_URL")
    auth = os.getenv("EBAY_AUTH_ID")
    pss = os.getenv("EBAY_CERT_ID")

    if not url or not auth or not pss:
        raise RuntimeError("Missing EBAY_URL / EBAY_AUTH_ID / EBAY_CERT_ID")

    resp = requests.post(
        f"{url.rstrip('/')}/identity/v1/oauth2/token",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        auth=HTTPBasicAuth(auth, pss),
        data={
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        },
        timeout=15,
    )
    try:
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as exc:
        raise RuntimeError(f"OAuth request failed: {resp.status_code} {resp.text}") from exc
    except ValueError as exc:
        raise RuntimeError("OAuth response was not valid JSON") from exc

    token = payload.get("access_token")
    if not token:
        raise RuntimeError(f"OAuth response missing access_token: {payload}")
    return token


def getEbayProduct(ebayProductID: str):
    if not ebayProductID:
        raise RuntimeError("Missing ebayProductID")

    url = os.getenv("EBAY_URL")
    oauth = generateOAuthKey()

    if not url or not oauth:
        raise RuntimeError("Missing URL and/or OAuth code failed to generate")

    resp = requests.get(
        f"{url.rstrip('/')}/buy/browse/v1/item/get_item_by_legacy_id",
        params={"legacy_item_id": ebayProductID},
        headers={
            "Authorization": f"Bearer {oauth}",
            "Accept": "application/json",
        },
        timeout=15,
    )

    try:
        resp.raise_for_status()
        return resp.status_code, resp.json()
    except requests.RequestException as exc:
        raise RuntimeError(f"eBay item lookup failed: {resp.status_code} {resp.text}") from exc
    except ValueError as exc:
        raise RuntimeError("eBay item response was not valid JSON") from exc


# Backwards-compatible alias for previous misspelling.
def getEbayProdcut(ebayProductID: str):
    return getEbayProduct(ebayProductID)




#print(getEbayProdcut("110589096548"))