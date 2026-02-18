"""
ScanPang Data Pipeline - Google Places 수집 모듈
Google Places API (Nearby Search)로 매장 정보를 보완 수집한다.

강남역/역삼역 주변 반경 500m 내의 매장을 카테고리별로 검색한다.
"""

import logging
import time

import pandas as pd
import requests

from config import (
    GOOGLE_PLACES_API_KEY,
    TARGET_CENTER_LAT,
    TARGET_CENTER_LNG,
    TARGET_RADIUS_M,
)

logger = logging.getLogger(__name__)

# Google Places Nearby Search API
NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Google Places 타입 매핑
# https://developers.google.com/maps/documentation/places/web-service/supported_types
GOOGLE_PLACE_TYPES = {
    "restaurant": "음식점",
    "cafe": "카페",
    "convenience_store": "편의점",
    "pharmacy": "약국",
    "bank": "은행",
    "hospital": "병원",
    "gym": "헬스장",
    "hair_care": "미용실",
    "parking": "주차장",
    "store": "상점",
}


def nearby_search(
    lat: float = TARGET_CENTER_LAT,
    lng: float = TARGET_CENTER_LNG,
    radius: int = TARGET_RADIUS_M,
    place_type: str = "restaurant",
    max_pages: int = 2,
) -> list[dict]:
    """
    Google Places Nearby Search API를 호출한다.
    next_page_token을 사용하여 페이지네이션을 처리한다.

    Args:
        lat: 검색 중심 위도
        lng: 검색 중심 경도
        radius: 검색 반경 (미터)
        place_type: Google Place 타입
        max_pages: 최대 페이지 수 (페이지당 최대 20건)

    Returns:
        검색 결과 리스트
    """
    all_results = []
    next_page_token = None

    for page in range(max_pages):
        params = {
            "key": GOOGLE_PLACES_API_KEY,
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": place_type,
            "language": "ko",
        }

        if next_page_token:
            params["pagetoken"] = next_page_token
            # Google API는 next_page_token 발급 후 짧은 지연이 필요
            time.sleep(2)

        try:
            resp = requests.get(NEARBY_SEARCH_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Google Places API 요청 실패 [{place_type}, 페이지 {page + 1}]: {e}")
            break
        except ValueError as e:
            logger.error(f"JSON 파싱 실패 [{place_type}]: {e}")
            break

        status = data.get("status")
        if status != "OK":
            if status == "ZERO_RESULTS":
                logger.info(f"Google Places [{place_type}]: 검색 결과 없음")
            elif status == "REQUEST_DENIED":
                logger.error(f"Google Places API 키 오류: {data.get('error_message', '')}")
            else:
                logger.warning(f"Google Places API 상태: {status}")
            break

        results = data.get("results", [])
        all_results.extend(results)
        logger.debug(f"Google Places [{place_type}] 페이지 {page + 1}: {len(results)}건")

        # 다음 페이지 토큰 확인
        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break

    return all_results


def collect_all_types() -> pd.DataFrame:
    """
    모든 카테고리에 대해 Google Places 검색을 수행한다.

    Returns:
        전체 매장 정보 데이터프레임
    """
    all_places = []

    for google_type, korean_category in GOOGLE_PLACE_TYPES.items():
        logger.info(f"Google Places 수집: {korean_category} ({google_type})")

        results = nearby_search(place_type=google_type, max_pages=2)

        for result in results:
            place = _parse_google_result(result, korean_category, google_type)
            all_places.append(place)

        time.sleep(0.3)  # API 호출 간격

    if not all_places:
        logger.warning("수집된 Google Places 데이터가 없습니다.")
        return pd.DataFrame()

    df = pd.DataFrame(all_places)

    # 중복 제거 (place_id 기준)
    df = df.drop_duplicates(subset=["place_id"], keep="first").reset_index(drop=True)

    logger.info(f"Google Places 수집 완료: {len(df)}건")
    return df


def _parse_google_result(result: dict, category: str, google_type: str) -> dict:
    """
    Google Places 검색 결과를 정규화된 딕셔너리로 변환한다.

    Args:
        result: Google Places API 응답 결과
        category: 한국어 카테고리명
        google_type: Google Place 타입

    Returns:
        정규화된 매장 정보 딕셔너리
    """
    location = result.get("geometry", {}).get("location", {})

    return {
        "place_id": result.get("place_id", ""),
        "title": result.get("name", ""),
        "category": category,
        "google_type": google_type,
        "address": result.get("vicinity", ""),
        "lat": location.get("lat"),
        "lng": location.get("lng"),
        "rating": result.get("rating"),
        "user_ratings_total": result.get("user_ratings_total"),
        "price_level": result.get("price_level"),
        "business_status": result.get("business_status", ""),
        "source": "google",
    }


def collect() -> pd.DataFrame:
    """Google Places 수집 파이프라인 실행 (외부 호출용)"""
    logger.info("=== Google Places 수집 시작 ===")
    df = collect_all_types()
    logger.info(f"=== Google Places 수집 완료: {len(df)}건 ===")
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    df = collect()
    if not df.empty:
        print(df[["title", "category", "address", "rating"]].head(20))
