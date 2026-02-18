"""
ScanPang Data Pipeline - 데이터 통합/정제 모듈
건축물대장 + 네이버 + 구글 데이터를 통합하고, 중복 제거 및 정규화를 수행한다.
"""

import logging
import re
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# 업종 카테고리 정규화 매핑
CATEGORY_NORMALIZE_MAP = {
    # 음식
    "음식점": "음식점",
    "한식": "음식점",
    "중식": "음식점",
    "일식": "음식점",
    "양식": "음식점",
    "분식": "음식점",
    "치킨": "음식점",
    "피자": "음식점",
    "패스트푸드": "음식점",
    "restaurant": "음식점",
    # 카페/디저트
    "카페": "카페",
    "커피": "카페",
    "디저트": "카페",
    "베이커리": "카페",
    "cafe": "카페",
    # 편의시설
    "편의점": "편의점",
    "convenience_store": "편의점",
    "약국": "약국",
    "pharmacy": "약국",
    "은행": "은행",
    "bank": "은행",
    "ATM": "은행",
    # 의료
    "병원": "병원",
    "의원": "병원",
    "치과": "병원",
    "한의원": "병원",
    "hospital": "병원",
    # 생활
    "미용실": "미용실",
    "헤어": "미용실",
    "hair_care": "미용실",
    "헬스장": "헬스장",
    "피트니스": "헬스장",
    "gym": "헬스장",
    # 교육
    "학원": "학원",
    "교육": "학원",
    # 기타
    "주차장": "주차장",
    "parking": "주차장",
    "상점": "상점",
    "store": "상점",
}

# 업종 아이콘 매핑
CATEGORY_ICON_MAP = {
    "음식점": "restaurant",
    "카페": "cafe",
    "편의점": "convenience_store",
    "약국": "local_pharmacy",
    "은행": "account_balance",
    "병원": "local_hospital",
    "미용실": "content_cut",
    "헬스장": "fitness_center",
    "학원": "school",
    "주차장": "local_parking",
    "상점": "store",
}


def normalize_category(raw_category: str) -> str:
    """업종 카테고리를 정규화한다."""
    if not raw_category:
        return "기타"

    raw_lower = raw_category.strip().lower()

    # 직접 매핑 확인
    if raw_lower in CATEGORY_NORMALIZE_MAP:
        return CATEGORY_NORMALIZE_MAP[raw_lower]

    # 부분 매칭 시도
    for keyword, normalized in CATEGORY_NORMALIZE_MAP.items():
        if keyword in raw_lower or raw_lower in keyword:
            return normalized

    return "기타"


def clean_html_tags(text: str) -> str:
    """HTML 태그를 제거한다."""
    if not text or not isinstance(text, str):
        return text or ""
    return re.sub(r"<[^>]+>", "", text).strip()


def normalize_address(address: str) -> str:
    """주소를 정규화한다 (공백 정리, 불필요 접두사 제거)."""
    if not address or not isinstance(address, str):
        return ""
    # 연속 공백 제거
    address = re.sub(r"\s+", " ", address).strip()
    return address


def merge_building_and_places(
    buildings_df: pd.DataFrame,
    naver_df: pd.DataFrame,
    google_df: pd.DataFrame,
) -> dict:
    """
    건축물대장 + 네이버 매장 + 구글 매장 데이터를 통합한다.

    통합 전략:
    1. 건축물대장 데이터를 기준(buildings)으로 건물 목록 확정
    2. 네이버/구글 매장을 주소 매칭으로 건물에 연결
    3. 매칭 안 되는 매장은 독립 매장으로 처리

    Args:
        buildings_df: 건축물대장 데이터
        naver_df: 네이버 매장 데이터
        google_df: 구글 매장 데이터

    Returns:
        {
            "buildings": pd.DataFrame,   # 건물 정보
            "tenants": pd.DataFrame,     # 입점 매장 정보
        }
    """
    logger.info("=== 데이터 통합 시작 ===")

    # ── 1) 건물 데이터 정제 ──
    buildings = _process_buildings(buildings_df)
    logger.info(f"건물 데이터: {len(buildings)}건")

    # ── 2) 매장 데이터 통합 ──
    tenants = _merge_places(naver_df, google_df)
    logger.info(f"매장 데이터 (통합 후): {len(tenants)}건")

    # ── 3) 매장을 건물에 매칭 ──
    tenants = _match_tenants_to_buildings(tenants, buildings)

    matched_count = tenants["building_idx"].notna().sum()
    logger.info(f"건물 매칭 완료: {matched_count}/{len(tenants)}건 매칭됨")

    logger.info("=== 데이터 통합 완료 ===")
    return {
        "buildings": buildings,
        "tenants": tenants,
    }


def _process_buildings(buildings_df: pd.DataFrame) -> pd.DataFrame:
    """건물 데이터를 DB 적재 형태로 정제한다."""
    if buildings_df is None or buildings_df.empty:
        return pd.DataFrame(columns=[
            "building_name", "address", "total_floors", "basement_floors",
            "building_use", "completion_year",
        ])

    df = buildings_df.copy()

    # 건물명 정리
    if "building_name" in df.columns:
        df["building_name"] = df["building_name"].apply(clean_html_tags)

    # 주소 정규화
    if "address" in df.columns:
        df["address"] = df["address"].apply(normalize_address)

    # 건물명 + 주소 기준 중복 제거 (가장 층수가 높은 것 우선)
    df = df.sort_values("ground_floors", ascending=False)
    df = df.drop_duplicates(subset=["building_name", "address"], keep="first")
    df = df.reset_index(drop=True)

    return df


def _merge_places(
    naver_df: Optional[pd.DataFrame],
    google_df: Optional[pd.DataFrame],
) -> pd.DataFrame:
    """네이버 + 구글 매장 데이터를 통합하고 중복을 제거한다."""
    frames = []

    # 네이버 데이터 정규화
    if naver_df is not None and not naver_df.empty:
        naver = naver_df.copy()
        naver["title"] = naver["title"].apply(clean_html_tags)
        naver["category_normalized"] = naver["category"].apply(normalize_category)
        naver["category_icon"] = naver["category_normalized"].map(CATEGORY_ICON_MAP).fillna("store")

        if "road_address" in naver.columns:
            naver["address"] = naver["road_address"].apply(normalize_address)
        else:
            naver["address"] = ""

        frames.append(naver[["title", "category_normalized", "category_icon", "address", "source"]].rename(
            columns={"category_normalized": "category"}
        ))

    # 구글 데이터 정규화
    if google_df is not None and not google_df.empty:
        google = google_df.copy()
        google["title"] = google["title"].apply(clean_html_tags)
        google["category_normalized"] = google["category"].apply(normalize_category)
        google["category_icon"] = google["category_normalized"].map(CATEGORY_ICON_MAP).fillna("store")
        google["address"] = google["address"].apply(normalize_address)

        # 좌표 정보 보존
        cols = ["title", "category_normalized", "category_icon", "address", "source"]
        if "lat" in google.columns:
            cols.extend(["lat", "lng"])
        frames.append(google[cols].rename(columns={"category_normalized": "category"}))

    if not frames:
        return pd.DataFrame(columns=["title", "category", "category_icon", "address", "source"])

    merged = pd.concat(frames, ignore_index=True)

    # 중복 제거: 매장명 정규화 후 비교
    merged["_title_norm"] = merged["title"].str.replace(r"\s+", "", regex=True).str.lower()
    merged = merged.drop_duplicates(subset=["_title_norm", "address"], keep="first")
    merged = merged.drop(columns=["_title_norm"]).reset_index(drop=True)

    return merged


def _match_tenants_to_buildings(
    tenants: pd.DataFrame,
    buildings: pd.DataFrame,
) -> pd.DataFrame:
    """
    매장의 주소를 기반으로 건물에 매칭한다.
    주소에 건물명이 포함되거나, 주소가 같은 경우 매칭한다.
    """
    tenants = tenants.copy()
    tenants["building_idx"] = None

    if buildings.empty or tenants.empty:
        return tenants

    for idx, building in buildings.iterrows():
        b_name = str(building.get("building_name", ""))
        b_addr = str(building.get("address", ""))

        if not b_addr:
            continue

        # 주소 기반 매칭: 매장 주소에 건물 주소의 핵심 부분이 포함되는지 확인
        # "서울 강남구 역삼동 xxx" 에서 동 이하를 비교
        addr_parts = b_addr.split()
        # 최소 2개 이상의 주소 토큰이 매칭되면 같은 건물로 간주
        for t_idx, tenant in tenants.iterrows():
            if tenants.at[t_idx, "building_idx"] is not None:
                continue  # 이미 매칭된 매장은 건너뜀

            t_addr = str(tenant.get("address", ""))
            t_title = str(tenant.get("title", ""))

            # 건물명이 매장 주소에 포함
            if b_name and len(b_name) > 2 and b_name in t_addr:
                tenants.at[t_idx, "building_idx"] = idx
                continue

            # 주소 공통 토큰 수 비교
            if t_addr and b_addr:
                common_tokens = set(addr_parts) & set(t_addr.split())
                if len(common_tokens) >= 3:
                    tenants.at[t_idx, "building_idx"] = idx

    return tenants


def merge(
    buildings_df: pd.DataFrame,
    naver_df: pd.DataFrame,
    google_df: pd.DataFrame,
) -> dict:
    """데이터 통합 파이프라인 실행 (외부 호출용)"""
    return merge_building_and_places(buildings_df, naver_df, google_df)
