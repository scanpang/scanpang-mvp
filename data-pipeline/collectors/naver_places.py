"""
ScanPang Data Pipeline - 네이버 장소 검색 수집 모듈
네이버 검색 API(지역 검색)를 사용하여 건물 주변 매장 정보를 수집한다.

API: 네이버 검색 > 지역 (Local)
"""

import logging
import time
from typing import Optional

import pandas as pd
import requests

from config import (
    NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET,
    TARGET_CENTER_LAT,
    TARGET_CENTER_LNG,
)

logger = logging.getLogger(__name__)

# 네이버 지역 검색 API
SEARCH_URL = "https://openapi.naver.com/v1/search/local.json"

# 수집 대상 업종 키워드
PLACE_CATEGORIES = [
    "음식점",
    "카페",
    "편의점",
    "약국",
    "은행",
    "병원",
    "미용실",
    "헬스장",
    "학원",
    "주차장",
]


def _get_headers() -> dict:
    """네이버 API 인증 헤더를 반환한다."""
    return {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }


def search_local(
    query: str,
    display: int = 5,
    start: int = 1,
    sort: str = "random",
) -> list[dict]:
    """
    네이버 지역 검색 API를 호출한다.

    Args:
        query: 검색어 (예: "역삼동 음식점")
        display: 한 번에 가져올 결과 수 (최대 5)
        start: 검색 시작 위치 (1~)
        sort: 정렬 기준 (random / comment)

    Returns:
        검색 결과 아이템 리스트
    """
    params = {
        "query": query,
        "display": display,
        "start": start,
        "sort": sort,
    }

    try:
        resp = requests.get(SEARCH_URL, headers=_get_headers(), params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])
    except requests.exceptions.RequestException as e:
        logger.error(f"네이버 검색 API 요청 실패 [{query}]: {e}")
        return []
    except ValueError as e:
        logger.error(f"JSON 파싱 실패 [{query}]: {e}")
        return []


def collect_places_around_buildings(
    buildings_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    건물 목록을 기반으로 주변 매장 정보를 수집한다.

    건물 데이터프레임이 주어지면 각 건물 주소 기반으로 검색하고,
    없으면 기본 지역(강남역/역삼역 부근)으로 검색한다.

    Args:
        buildings_df: 건축물대장 데이터프레임 (선택)

    Returns:
        매장 정보 데이터프레임
    """
    all_places = []

    # 건물별로 주변 매장 검색
    if buildings_df is not None and not buildings_df.empty:
        # 건물명이 있는 건물 우선 검색
        search_targets = buildings_df[
            buildings_df["building_name"].notna() & (buildings_df["building_name"] != "")
        ]["building_name"].unique()[:30]  # 상위 30개 건물로 제한

        for building_name in search_targets:
            for category in PLACE_CATEGORIES:
                query = f"{building_name} {category}"
                items = search_local(query, display=5)

                for item in items:
                    place = _parse_naver_item(item, category, building_name)
                    all_places.append(place)

                time.sleep(0.2)  # API 호출 간격

    # 기본 지역 검색 (역삼동 / 강남역 / 역삼역 주변)
    base_queries = ["역삼동", "강남역", "역삼역", "테헤란로"]
    for base_query in base_queries:
        for category in PLACE_CATEGORIES:
            query = f"{base_query} {category}"
            items = search_local(query, display=5)

            for item in items:
                place = _parse_naver_item(item, category, base_query)
                all_places.append(place)

            time.sleep(0.2)

    if not all_places:
        logger.warning("수집된 네이버 매장 데이터가 없습니다.")
        return pd.DataFrame()

    df = pd.DataFrame(all_places)

    # 중복 제거 (매장명 + 주소 기준)
    df = df.drop_duplicates(subset=["title", "road_address"], keep="first").reset_index(drop=True)

    logger.info(f"네이버 매장 수집 완료: {len(df)}건")
    return df


def _parse_naver_item(item: dict, category: str, search_context: str) -> dict:
    """
    네이버 검색 결과 아이템을 정규화된 딕셔너리로 변환한다.

    Args:
        item: 네이버 API 응답 아이템
        category: 검색 카테고리
        search_context: 검색 맥락 (건물명 또는 지역명)

    Returns:
        정규화된 매장 정보 딕셔너리
    """
    # HTML 태그 제거 (네이버 API는 <b> 태그를 포함)
    title = item.get("title", "").replace("<b>", "").replace("</b>", "")

    # 네이버 좌표계 (카텍 -> WGS84 근사 변환은 geocoder에서 처리)
    mapx = item.get("mapx", "")
    mapy = item.get("mapy", "")

    return {
        "title": title,
        "category": category,
        "naver_category": item.get("category", ""),
        "road_address": item.get("roadAddress", ""),
        "jibun_address": item.get("address", ""),
        "mapx": mapx,
        "mapy": mapy,
        "link": item.get("link", ""),
        "telephone": item.get("telephone", ""),
        "search_context": search_context,
        "source": "naver",
    }


def collect(buildings_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """네이버 매장 수집 파이프라인 실행 (외부 호출용)"""
    logger.info("=== 네이버 매장 수집 시작 ===")
    df = collect_places_around_buildings(buildings_df)
    logger.info(f"=== 네이버 매장 수집 완료: {len(df)}건 ===")
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    df = collect()
    if not df.empty:
        print(df[["title", "category", "road_address"]].head(20))
