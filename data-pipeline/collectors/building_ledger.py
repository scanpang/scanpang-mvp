"""
ScanPang Data Pipeline - 건축물대장 수집 모듈
공공데이터포털 건축물대장 API를 통해 강남구/역삼동 건축물 정보를 수집한다.

API: 국토교통부_건축물대장정보 서비스
엔드포인트: 건축물대장 기본개요 조회 (getBrTitleInfo)
"""

import logging
import time
import xml.etree.ElementTree as ET
from typing import Optional

import pandas as pd
import requests

from config import DATA_GO_KR_API_KEY, SIGUNGU_CD, BJDONG_CD

logger = logging.getLogger(__name__)

# 공공데이터포털 건축물대장 기본개요 API
BASE_URL = "http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo"


def fetch_building_ledger(
    sigungu_cd: str = SIGUNGU_CD,
    bjdong_cd: str = BJDONG_CD,
    num_of_rows: int = 100,
    max_pages: int = 10,
) -> pd.DataFrame:
    """
    건축물대장 기본개요를 페이지네이션하여 수집한다.

    Args:
        sigungu_cd: 시군구코드 (기본값: 강남구 11680)
        bjdong_cd: 법정동코드 (기본값: 역삼동 10300)
        num_of_rows: 페이지당 건수
        max_pages: 최대 페이지 수

    Returns:
        건축물대장 데이터프레임
    """
    all_items = []

    for page_no in range(1, max_pages + 1):
        logger.info(f"건축물대장 수집 중... 페이지 {page_no}/{max_pages}")

        params = {
            "serviceKey": DATA_GO_KR_API_KEY,
            "sigunguCd": sigungu_cd,
            "bjdongCd": bjdong_cd,
            "numOfRows": num_of_rows,
            "pageNo": page_no,
            "resultType": "json",
        }

        try:
            resp = requests.get(BASE_URL, params=params, timeout=30)
            resp.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.error(f"API 요청 실패 (페이지 {page_no}): {e}")
            break

        # JSON 파싱 시도, 실패 시 XML 파싱
        content_type = resp.headers.get("content-type", "")
        try:
            if "xml" in content_type:
                raise ValueError("XML response detected")
            data = resp.json()
            body = data.get("response", {}).get("body", {})
            total_count = body.get("totalCount", 0)
            items = body.get("items", {})
            if not items:
                logger.info(f"페이지 {page_no}: 데이터 없음. 수집 종료.")
                break
            item_list = items if isinstance(items, list) else items.get("item", [])
            if isinstance(item_list, dict):
                item_list = [item_list]
        except (ValueError, KeyError):
            # XML 파싱 fallback
            try:
                root = ET.fromstring(resp.text)
                body_el = root.find(".//body")
                if body_el is None:
                    logger.error(f"페이지 {page_no}: XML에서 body를 찾을 수 없음")
                    break
                total_count_el = body_el.find("totalCount")
                total_count = int(total_count_el.text) if total_count_el is not None else 0
                item_elements = root.findall(".//item")
                if not item_elements:
                    logger.info(f"페이지 {page_no}: 데이터 없음. 수집 종료.")
                    break
                item_list = []
                for item_el in item_elements:
                    item_dict = {}
                    for child in item_el:
                        item_dict[child.tag] = child.text
                    item_list.append(item_dict)
                logger.debug(f"페이지 {page_no}: XML 파싱 성공 ({len(item_list)}건)")
            except ET.ParseError as e:
                logger.error(f"XML 파싱 실패 (페이지 {page_no}): {e}")
                break

        all_items.extend(item_list)
        logger.info(f"페이지 {page_no}: {len(item_list)}건 수집 (누적 {len(all_items)}/{total_count})")

        # 전체 데이터 수집 완료 확인
        if len(all_items) >= total_count:
            logger.info("전체 데이터 수집 완료.")
            break

        # API 과부하 방지를 위한 딜레이
        time.sleep(0.5)

    if not all_items:
        logger.warning("수집된 건축물대장 데이터가 없습니다.")
        return pd.DataFrame()

    df = pd.DataFrame(all_items)
    logger.info(f"건축물대장 원시 데이터: {len(df)}건, 컬럼: {list(df.columns)}")

    return df


def parse_building_ledger(df: pd.DataFrame) -> pd.DataFrame:
    """
    건축물대장 원시 데이터에서 필요한 필드를 추출·정제한다.

    추출 필드:
        - bldNm: 건물명
        - platPlc / newPlatPlc: 지번주소 / 도로명주소
        - grndFlrCnt: 지상 층수
        - ugrndFlrCnt: 지하 층수
        - mainPurpsCdNm: 주용도
        - useAprDay: 사용승인일 (준공연도 추출)

    Returns:
        정제된 건축물 데이터프레임
    """
    if df.empty:
        return pd.DataFrame()

    # 필요 컬럼 매핑
    column_map = {
        "bldNm": "building_name",         # 건물명
        "platPlc": "jibun_address",        # 지번주소
        "newPlatPlc": "road_address",      # 도로명주소
        "grndFlrCnt": "ground_floors",     # 지상 층수
        "ugrndFlrCnt": "basement_floors",  # 지하 층수
        "mainPurpsCdNm": "building_use",   # 주용도
        "useAprDay": "approval_date",      # 사용승인일
        "mgmBldrgstPk": "ledger_pk",       # 건축물대장 관리번호 (고유키)
    }

    # 존재하는 컬럼만 선택
    available_cols = {k: v for k, v in column_map.items() if k in df.columns}
    result = df[list(available_cols.keys())].rename(columns=available_cols).copy()

    # 지상 층수 정수 변환
    if "ground_floors" in result.columns:
        result["ground_floors"] = pd.to_numeric(result["ground_floors"], errors="coerce").fillna(0).astype(int)

    # 지하 층수 정수 변환
    if "basement_floors" in result.columns:
        result["basement_floors"] = pd.to_numeric(result["basement_floors"], errors="coerce").fillna(0).astype(int)

    # 총 층수 계산
    result["total_floors"] = result.get("ground_floors", 0) + result.get("basement_floors", 0)

    # 준공연도 추출 (사용승인일 앞 4자리)
    if "approval_date" in result.columns:
        result["completion_year"] = (
            result["approval_date"]
            .astype(str)
            .str[:4]
            .apply(lambda x: int(x) if x.isdigit() and int(x) > 1900 else None)
        )

    # 주소 통합 (도로명주소 우선, 없으면 지번주소)
    if "road_address" in result.columns and "jibun_address" in result.columns:
        result["address"] = result["road_address"].fillna(result["jibun_address"])
    elif "road_address" in result.columns:
        result["address"] = result["road_address"]
    elif "jibun_address" in result.columns:
        result["address"] = result["jibun_address"]
    else:
        result["address"] = ""

    # 건물명이 없는 경우 주소로 대체
    if "building_name" in result.columns:
        result["building_name"] = result["building_name"].fillna("").replace("", None)
        mask = result["building_name"].isna() | (result["building_name"] == "")
        result.loc[mask, "building_name"] = result.loc[mask, "address"]

    # 건물명이 있고 층수가 1 이상인 건물만 필터링 (의미 있는 건물)
    result = result[result["ground_floors"] >= 1].reset_index(drop=True)

    logger.info(f"건축물대장 정제 완료: {len(result)}건")
    return result


def collect() -> pd.DataFrame:
    """건축물대장 수집 파이프라인 실행 (외부 호출용)"""
    logger.info("=== 건축물대장 수집 시작 ===")
    raw_df = fetch_building_ledger()
    parsed_df = parse_building_ledger(raw_df)
    logger.info(f"=== 건축물대장 수집 완료: {len(parsed_df)}건 ===")
    return parsed_df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    df = collect()
    if not df.empty:
        print(df[["building_name", "address", "ground_floors", "building_use"]].head(20))
