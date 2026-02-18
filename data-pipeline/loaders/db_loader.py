"""
ScanPang Data Pipeline - DB 적재 모듈
정제된 데이터를 PostgreSQL(Supabase)에 적재한다.

대상 테이블: buildings, floors, facilities, building_stats, live_feeds
"""

import logging
from typing import Optional

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from config import get_db_params

logger = logging.getLogger(__name__)


def get_connection():
    """PostgreSQL 연결을 생성하고 반환한다."""
    params = get_db_params()
    logger.info(f"DB 연결 시도: {params['host']}:{params['port']}/{params['dbname']}")
    conn = psycopg2.connect(**params)
    conn.autocommit = False
    return conn


def load_buildings(conn, buildings_df: pd.DataFrame) -> dict:
    """
    건물 데이터를 buildings 테이블에 적재한다.

    Args:
        conn: psycopg2 연결 객체
        buildings_df: 건물 데이터프레임

    Returns:
        {"inserted": int, "id_map": dict} - 삽입 건수 및 건물명→ID 매핑
    """
    if buildings_df.empty:
        logger.warning("적재할 건물 데이터가 없습니다.")
        return {"inserted": 0, "id_map": {}}

    cur = conn.cursor()
    inserted = 0
    id_map = {}  # building_name → building_id

    insert_sql = """
        INSERT INTO buildings (name, address, location, total_floors, basement_floors,
                               building_use, completion_year)
        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        RETURNING id, name;
    """

    for _, row in buildings_df.iterrows():
        name = row.get("building_name", "")
        address = row.get("address", "")
        lat = row.get("lat")
        lng = row.get("lng")
        total_floors = row.get("ground_floors", 0)
        basement_floors = row.get("basement_floors", 0)
        building_use = row.get("building_use", "")
        completion_year = row.get("completion_year")

        # 좌표가 없는 경우 기본값 (강남역 부근)
        if lat is None or lng is None or pd.isna(lat) or pd.isna(lng):
            lat, lng = 37.4979, 127.0276

        try:
            cur.execute(insert_sql, (
                name, address, float(lng), float(lat),
                int(total_floors), int(basement_floors),
                building_use,
                int(completion_year) if completion_year and not pd.isna(completion_year) else None,
            ))
            result = cur.fetchone()
            if result:
                id_map[result[1]] = result[0]
                inserted += 1
        except Exception as e:
            logger.error(f"건물 INSERT 실패 [{name}]: {e}")
            conn.rollback()
            continue

    conn.commit()
    logger.info(f"buildings 테이블 적재: {inserted}건")
    return {"inserted": inserted, "id_map": id_map}


def load_floors(conn, tenants_df: pd.DataFrame, building_id_map: dict) -> int:
    """
    매장(입점 업체) 데이터를 floors 테이블에 적재한다.
    각 매장을 건물의 층별 입점 정보로 매핑한다.

    Args:
        conn: psycopg2 연결 객체
        tenants_df: 매장 데이터프레임
        building_id_map: 건물명→ID 매핑 딕셔너리

    Returns:
        삽입 건수
    """
    if tenants_df.empty:
        logger.warning("적재할 매장 데이터가 없습니다.")
        return 0

    cur = conn.cursor()
    inserted = 0

    insert_sql = """
        INSERT INTO floors (building_id, floor_number, floor_order,
                            tenant_name, tenant_category, tenant_icon, is_vacant)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """

    # building_idx로 매칭된 매장만 처리
    for _, row in tenants_df.iterrows():
        building_idx = row.get("building_idx")
        if building_idx is None or pd.isna(building_idx):
            continue

        # building_idx에서 실제 building_id 추출
        # building_id_map을 역으로 활용 (인덱스 기반)
        building_id = _resolve_building_id(building_idx, building_id_map)
        if not building_id:
            continue

        title = row.get("title", "알 수 없음")
        category = row.get("category", "기타")
        icon = row.get("category_icon", "store")

        # MVP에서는 층 정보를 정확히 알 수 없으므로 1F로 기본 설정
        floor_number = "1F"
        floor_order = 1

        try:
            cur.execute(insert_sql, (
                building_id, floor_number, floor_order,
                title, category, icon, False,
            ))
            inserted += 1
        except Exception as e:
            logger.error(f"매장 INSERT 실패 [{title}]: {e}")
            conn.rollback()
            continue

    conn.commit()
    logger.info(f"floors 테이블 적재: {inserted}건")
    return inserted


def load_facilities(conn, buildings_df: pd.DataFrame, building_id_map: dict) -> int:
    """
    건물 편의시설 데이터를 facilities 테이블에 적재한다.
    MVP에서는 건물 특성 기반으로 기본 편의시설을 자동 생성한다.

    Args:
        conn: psycopg2 연결 객체
        buildings_df: 건물 데이터프레임
        building_id_map: 건물명→ID 매핑

    Returns:
        삽입 건수
    """
    cur = conn.cursor()
    inserted = 0

    # 건물 용도에 따른 기본 편의시설 매핑
    default_facilities = [
        {"facility_type": "주차장", "location_info": "B1-B2", "status_text": "유료"},
        {"facility_type": "와이파이", "location_info": "전층", "status_text": "무료"},
        {"facility_type": "냉난방", "location_info": "전층", "status_text": "중앙 공급"},
    ]

    insert_sql = """
        INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """

    for building_name, building_id in building_id_map.items():
        for facility in default_facilities:
            try:
                cur.execute(insert_sql, (
                    building_id,
                    facility["facility_type"],
                    facility["location_info"],
                    True,
                    facility["status_text"],
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"편의시설 INSERT 실패 [{building_name}]: {e}")
                continue

    conn.commit()
    logger.info(f"facilities 테이블 적재: {inserted}건")
    return inserted


def load_building_stats(conn, buildings_df: pd.DataFrame, building_id_map: dict) -> int:
    """
    건물 통계 데이터를 building_stats 테이블에 적재한다.

    Args:
        conn: psycopg2 연결 객체
        buildings_df: 건물 데이터프레임
        building_id_map: 건물명→ID 매핑

    Returns:
        삽입 건수
    """
    cur = conn.cursor()
    inserted = 0

    insert_sql = """
        INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """

    for _, row in buildings_df.iterrows():
        building_name = row.get("building_name", "")
        building_id = building_id_map.get(building_name)

        if not building_id:
            continue

        ground_floors = row.get("ground_floors", 0)
        basement_floors = row.get("basement_floors", 0)

        stats = [
            ("total_floors", f"{ground_floors}층", "layers", 1),
            ("basement", f"지하 {basement_floors}층", "arrow_downward", 2),
            ("occupancy", "85%", "pie_chart", 3),          # MVP 더미 값
            ("tenants", f"{max(ground_floors, 1) * 2}개", "store", 4),  # 추정치
            ("congestion", "보통", "people", 5),            # MVP 더미 값
        ]

        for stat_type, stat_value, stat_icon, display_order in stats:
            try:
                cur.execute(insert_sql, (
                    building_id, stat_type, stat_value, stat_icon, display_order,
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"통계 INSERT 실패 [{building_name}/{stat_type}]: {e}")
                continue

    conn.commit()
    logger.info(f"building_stats 테이블 적재: {inserted}건")
    return inserted


def load_live_feeds(conn, building_id_map: dict) -> int:
    """
    LIVE 피드 더미 데이터를 live_feeds 테이블에 적재한다.
    MVP에서는 건물별로 기본 피드를 자동 생성한다.

    Args:
        conn: psycopg2 연결 객체
        building_id_map: 건물명→ID 매핑

    Returns:
        삽입 건수
    """
    cur = conn.cursor()
    inserted = 0

    # 기본 LIVE 피드 템플릿
    feed_templates = [
        {
            "feed_type": "congestion",
            "title": "현재 혼잡도: 보통",
            "description": "평상시 대비 적정 수준입니다.",
            "icon": "people",
            "icon_color": "green",
            "time_label": "현재",
        },
        {
            "feed_type": "event",
            "title": "1층 로비 리모델링 공사 중",
            "description": "2층 출입구를 이용해 주세요.",
            "icon": "construction",
            "icon_color": "orange",
            "time_label": "오늘",
        },
        {
            "feed_type": "promotion",
            "title": "B1 카페 오픈 기념 할인",
            "description": "아메리카노 50% 할인 (~이번주)",
            "icon": "local_offer",
            "icon_color": "red",
            "time_label": "진행중",
        },
    ]

    insert_sql = """
        INSERT INTO live_feeds (building_id, feed_type, title, description,
                                icon, icon_color, time_label, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """

    for building_name, building_id in building_id_map.items():
        for feed in feed_templates:
            try:
                cur.execute(insert_sql, (
                    building_id,
                    feed["feed_type"],
                    feed["title"],
                    feed["description"],
                    feed["icon"],
                    feed["icon_color"],
                    feed["time_label"],
                    True,
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"LIVE 피드 INSERT 실패 [{building_name}]: {e}")
                continue

    conn.commit()
    logger.info(f"live_feeds 테이블 적재: {inserted}건")
    return inserted


def _resolve_building_id(building_idx, building_id_map: dict) -> Optional[int]:
    """
    데이터프레임 인덱스에서 DB의 building_id를 해석한다.
    building_id_map의 값 리스트에서 인덱스로 접근한다.
    """
    try:
        ids = list(building_id_map.values())
        idx = int(building_idx)
        if 0 <= idx < len(ids):
            return ids[idx]
    except (ValueError, IndexError, TypeError):
        pass
    return None


def load_all(merged_data: dict) -> dict:
    """
    전체 데이터를 DB에 적재하는 메인 함수.

    Args:
        merged_data: merger.merge()의 반환값
            {
                "buildings": pd.DataFrame,
                "tenants": pd.DataFrame,
            }

    Returns:
        적재 결과 요약 딕셔너리
    """
    logger.info("=== DB 적재 시작 ===")

    buildings_df = merged_data.get("buildings", pd.DataFrame())
    tenants_df = merged_data.get("tenants", pd.DataFrame())

    try:
        conn = get_connection()
        logger.info("DB 연결 성공")
    except Exception as e:
        logger.error(f"DB 연결 실패: {e}")
        return {"error": str(e)}

    try:
        # 1. 건물 적재
        building_result = load_buildings(conn, buildings_df)
        building_id_map = building_result["id_map"]

        # 2. 층별 매장 적재
        floors_inserted = load_floors(conn, tenants_df, building_id_map)

        # 3. 편의시설 적재
        facilities_inserted = load_facilities(conn, buildings_df, building_id_map)

        # 4. 건물 통계 적재
        stats_inserted = load_building_stats(conn, buildings_df, building_id_map)

        # 5. LIVE 피드 적재
        feeds_inserted = load_live_feeds(conn, building_id_map)

        result = {
            "buildings": building_result["inserted"],
            "floors": floors_inserted,
            "facilities": facilities_inserted,
            "building_stats": stats_inserted,
            "live_feeds": feeds_inserted,
        }

        logger.info(f"=== DB 적재 완료: {result} ===")
        return result

    except Exception as e:
        logger.error(f"DB 적재 중 오류 발생: {e}")
        conn.rollback()
        return {"error": str(e)}
    finally:
        conn.close()
        logger.info("DB 연결 종료")
