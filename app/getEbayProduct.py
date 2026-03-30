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


def _ebay_headers(oauth: str) -> dict:
    return {
        "Authorization": f"Bearer {oauth}",
        "Accept": "application/json",
    }


def _normalize_item_group_payload(payload: dict, item_group_id: str) -> dict:
    """Return the first item summary in an item-group response as a product-like payload."""
    item_summaries = payload.get("itemSummaries") or []
    if not item_summaries:
        raise RuntimeError(f"Item group lookup returned no items for {item_group_id}")

    first_item = item_summaries[0]
    normalized = dict(first_item)

    # Preserve the group id so callers can still see the original source id when useful.
    normalized.setdefault("itemGroupId", payload.get("itemGroupId") or item_group_id)
    normalized.setdefault("legacyItemId", first_item.get("legacyItemId") or item_group_id)

    return normalized


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
        headers=_ebay_headers(oauth),
        timeout=15,
    )

    try:
        resp.raise_for_status()
        return resp.status_code, resp.json()
    except requests.RequestException as exc:
        try:
            error_payload = resp.json()
        except ValueError:
            error_payload = None

        errors = error_payload.get("errors") if isinstance(error_payload, dict) else None
        error_id = errors[0].get("errorId") if errors else None

        # eBay uses error 11006 when the provided ID is actually an item group id.
        if resp.status_code == 400 and error_id == 11006:
            group_resp = requests.get(
                f"{url.rstrip('/')}/buy/browse/v1/item/get_items_by_item_group",
                params={"item_group_id": ebayProductID},
                headers=_ebay_headers(oauth),
                timeout=15,
            )

            try:
                group_resp.raise_for_status()
                group_payload = group_resp.json()
                return group_resp.status_code, _normalize_item_group_payload(group_payload, ebayProductID)
            except requests.RequestException as group_exc:
                raise RuntimeError(
                    f"eBay item group lookup failed: {group_resp.status_code} {group_resp.text}"
                ) from group_exc
            except ValueError as group_exc:
                raise RuntimeError("eBay item group response was not valid JSON") from group_exc

        raise RuntimeError(f"eBay item lookup failed: {resp.status_code} {resp.text}") from exc
    except ValueError as exc:
        raise RuntimeError("eBay item response was not valid JSON") from exc


# Backwards-compatible alias for previous misspelling.
def getEbayProdcut(ebayProductID: str):
    return getEbayProduct(ebayProductID)




#print(getEbayProdcut("157712932448"))
