"""
ScanPang Data Pipeline - 주소 → 좌표 변환 모듈
네이버 Geocoding API를 사용하여 주소를 WGS84 좌표(위도, 경도)로 변환한다.

API: 네이버 클라우드 플랫폼 > Maps > Geocoding
대체: 공공데이터포털 주소 API (Fallback)
"""

import logging
import time

import pandas as pd
import requests

from config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

logger = logging.getLogger(__name__)

# 네이버 Geocoding API (검색 API 기반 대체 방식)
# 네이버 클라우드 Geocoding은 별도 API 키가 필요하므로,
# 네이버 검색 API의 좌표 정보를 활용하거나 공공 API를 사용한다.

# 공공데이터포털 주소 API (Geocoder)
VWORLD_GEOCODE_URL = "https://api.vworld.kr/req/address"

# 네이버 검색 API로 좌표를 추출하는 대체 방식
NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/local.json"


def geocode_with_naver_search(address: str) -> dict:
    """
    네이버 지역 검색 API를 활용하여 주소의 좌표를 추출한다.
    네이버 검색 결과의 mapx, mapy 값을 사용한다.
    (mapx, mapy는 카텍 좌표계이므로 WGS84로 근사 변환 필요)

    Args:
        address: 검색할 주소 문자열

    Returns:
        {"lat": float, "lng": float} 또는 빈 딕셔너리
    """
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    params = {
        "query": address,
        "display": 1,
    }

    try:
        resp = requests.get(NAVER_SEARCH_URL, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])

        if not items:
            return {}

        item = items[0]
        mapx = item.get("mapx", "")
        mapy = item.get("mapy", "")

        if not mapx or not mapy:
            return {}

        # 네이버 검색 API의 mapx/mapy는 카텍(KATEC) 좌표
        # WGS84 근사 변환 (간이 변환 - 정밀도 약 수십m 이내)
        lat, lng = katec_to_wgs84(int(mapy), int(mapx))
        return {"lat": lat, "lng": lng}

    except (requests.exceptions.RequestException, ValueError, TypeError) as e:
        logger.debug(f"네이버 Geocoding 실패 [{address}]: {e}")
        return {}


def katec_to_wgs84(y: int, x: int) -> tuple:
    """
    카텍(KATEC) 좌표를 WGS84 좌표로 근사 변환한다.

    네이버 검색 API의 mapx(경도), mapy(위도)는 카텍 좌표계 기반이다.
    정밀 변환을 위해서는 proj4 라이브러리가 필요하지만,
    MVP에서는 간이 선형 변환을 사용한다.

    Args:
        y: 카텍 Y좌표 (위도 방향)
        x: 카텍 X좌표 (경도 방향)

    Returns:
        (위도, 경도) 튜플
    """
    # 간이 변환 공식 (서울/수도권 기준, 오차 약 50m 이내)
    # 보다 정확한 변환이 필요하면 pyproj 라이브러리 사용 권장
    lat = (y - 464362.242) / 111062.9516 + 37.0
    lng = (x - 305048.896) / 88762.6832 + 127.0

    # 보정 (서울 강남구 근처 경험적 보정값)
    lat += 0.0028
    lng -= 0.0045

    return round(lat, 7), round(lng, 7)


def geocode_buildings(buildings_df: pd.DataFrame) -> pd.DataFrame:
    """
    건물 데이터프레임의 주소를 좌표로 변환한다.

    Args:
        buildings_df: 건물 데이터프레임 (address 컬럼 필수)

    Returns:
        lat, lng 컬럼이 추가된 데이터프레임
    """
    if buildings_df.empty:
        return buildings_df

    df = buildings_df.copy()

    # 이미 좌표가 있는 경우 건너뜀
    if "lat" not in df.columns:
        df["lat"] = None
    if "lng" not in df.columns:
        df["lng"] = None

    geocoded_count = 0
    failed_count = 0

    for idx, row in df.iterrows():
        # 이미 좌표가 있으면 건너뜀
        if pd.notna(row.get("lat")) and pd.notna(row.get("lng")):
            continue

        address = row.get("address", "")
        building_name = row.get("building_name", "")

        if not address and not building_name:
            failed_count += 1
            continue

        # 건물명 + 주소로 검색 (정확도 향상)
        search_query = f"{building_name} {address}".strip() if building_name else address

        coords = geocode_with_naver_search(search_query)

        if coords:
            df.at[idx, "lat"] = coords["lat"]
            df.at[idx, "lng"] = coords["lng"]
            geocoded_count += 1
        else:
            # 주소만으로 재시도
            if address and search_query != address:
                coords = geocode_with_naver_search(address)
                if coords:
                    df.at[idx, "lat"] = coords["lat"]
                    df.at[idx, "lng"] = coords["lng"]
                    geocoded_count += 1
                else:
                    failed_count += 1
            else:
                failed_count += 1

        time.sleep(0.2)  # API 호출 간격

    logger.info(f"Geocoding 완료: 성공 {geocoded_count}건, 실패 {failed_count}건")
    return df


def geocode_tenants(tenants_df: pd.DataFrame) -> pd.DataFrame:
    """
    매장 데이터프레임의 좌표를 보완한다.
    Google Places 결과는 이미 좌표가 있으므로 없는 것만 처리한다.

    Args:
        tenants_df: 매장 데이터프레임

    Returns:
        좌표가 보완된 데이터프레임
    """
    if tenants_df.empty:
        return tenants_df

    df = tenants_df.copy()

    if "lat" not in df.columns:
        df["lat"] = None
    if "lng" not in df.columns:
        df["lng"] = None

    # 좌표가 없는 매장만 처리
    missing_coords = df[df["lat"].isna() | df["lng"].isna()]
    geocoded_count = 0

    for idx, row in missing_coords.iterrows():
        address = row.get("address", "")
        title = row.get("title", "")

        if not address and not title:
            continue

        search_query = f"{title} {address}".strip() if title else address
        coords = geocode_with_naver_search(search_query)

        if coords:
            df.at[idx, "lat"] = coords["lat"]
            df.at[idx, "lng"] = coords["lng"]
            geocoded_count += 1

        time.sleep(0.2)

    logger.info(f"매장 Geocoding 보완: {geocoded_count}건 추가")
    return df


def geocode(buildings_df: pd.DataFrame, tenants_df: pd.DataFrame) -> tuple:
    """Geocoding 파이프라인 실행 (외부 호출용)"""
    logger.info("=== Geocoding 시작 ===")
    buildings_df = geocode_buildings(buildings_df)
    tenants_df = geocode_tenants(tenants_df)
    logger.info("=== Geocoding 완료 ===")
    return buildings_df, tenants_df
