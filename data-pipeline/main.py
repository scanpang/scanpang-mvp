"""
ScanPang Data Pipeline - 메인 엔트리포인트
수집(Collect) → 정제(Process) → 적재(Load) 순서로 파이프라인을 실행한다.

사용법:
    python main.py              # 전체 파이프라인 실행
    python main.py --collect    # 수집만 실행
    python main.py --process    # 정제만 실행 (수집 데이터 필요)
    python main.py --load       # 적재만 실행 (정제 데이터 필요)
"""

import argparse
import logging
import sys
import time
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            encoding="utf-8",
        ),
    ],
)

logger = logging.getLogger("scanpang.pipeline")


def run_collect():
    """
    데이터 수집 단계
    - 건축물대장 (공공데이터포털)
    - 네이버 매장 검색
    - Google Places 매장 검색
    """
    from collectors.building_ledger import collect as collect_buildings
    from collectors.naver_places import collect as collect_naver
    from collectors.google_places import collect as collect_google

    logger.info("=" * 60)
    logger.info("STEP 1: 데이터 수집 시작")
    logger.info("=" * 60)

    # 1-1. 건축물대장 수집
    buildings_df = collect_buildings()
    logger.info(f"건축물대장: {len(buildings_df)}건 수집")

    # 1-2. 네이버 매장 수집 (건물 데이터를 전달하여 건물 주변 검색)
    naver_df = collect_naver(buildings_df)
    logger.info(f"네이버 매장: {len(naver_df)}건 수집")

    # 1-3. Google Places 매장 수집
    google_df = collect_google()
    logger.info(f"Google Places: {len(google_df)}건 수집")

    return buildings_df, naver_df, google_df


def run_process(buildings_df, naver_df, google_df):
    """
    데이터 정제 단계
    - 데이터 통합/정규화
    - Geocoding (주소 → 좌표 변환)
    """
    from processors.merger import merge
    from processors.geocoder import geocode

    logger.info("=" * 60)
    logger.info("STEP 2: 데이터 정제 시작")
    logger.info("=" * 60)

    # 2-1. 데이터 통합
    merged = merge(buildings_df, naver_df, google_df)
    logger.info(f"통합 건물: {len(merged['buildings'])}건")
    logger.info(f"통합 매장: {len(merged['tenants'])}건")

    # 2-2. Geocoding
    merged["buildings"], merged["tenants"] = geocode(
        merged["buildings"], merged["tenants"]
    )

    geocoded_buildings = merged["buildings"]["lat"].notna().sum() if "lat" in merged["buildings"].columns else 0
    logger.info(f"Geocoding 완료 건물: {geocoded_buildings}건")

    return merged


def run_load(merged_data):
    """
    데이터 적재 단계
    - PostgreSQL(Supabase)에 적재
    """
    from loaders.db_loader import load_all

    logger.info("=" * 60)
    logger.info("STEP 3: DB 적재 시작")
    logger.info("=" * 60)

    result = load_all(merged_data)

    if "error" in result:
        logger.error(f"DB 적재 실패: {result['error']}")
    else:
        logger.info(f"DB 적재 결과:")
        for table, count in result.items():
            logger.info(f"  - {table}: {count}건")

    return result


def run_pipeline(steps: str = "all"):
    """
    파이프라인 전체 또는 특정 단계를 실행한다.

    Args:
        steps: "all", "collect", "process", "load"
    """
    start_time = time.time()

    logger.info("=" * 60)
    logger.info("ScanPang Data Pipeline 시작")
    logger.info(f"실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"실행 단계: {steps}")
    logger.info("=" * 60)

    try:
        if steps in ("all", "collect"):
            buildings_df, naver_df, google_df = run_collect()

        if steps in ("all", "process"):
            if steps == "process":
                logger.error("--process 단독 실행은 아직 지원하지 않습니다. 전체 파이프라인을 실행하세요.")
                return
            merged_data = run_process(buildings_df, naver_df, google_df)

        if steps in ("all", "load"):
            if steps == "load":
                logger.error("--load 단독 실행은 아직 지원하지 않습니다. 전체 파이프라인을 실행하세요.")
                return
            result = run_load(merged_data)

        elapsed = time.time() - start_time
        logger.info("=" * 60)
        logger.info(f"ScanPang Data Pipeline 완료 (소요시간: {elapsed:.1f}초)")
        logger.info("=" * 60)

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"파이프라인 실행 중 오류 발생: {e}", exc_info=True)
        logger.info(f"실패까지 소요시간: {elapsed:.1f}초")
        raise


def main():
    parser = argparse.ArgumentParser(description="ScanPang Data Pipeline")
    parser.add_argument("--collect", action="store_true", help="수집 단계만 실행")
    parser.add_argument("--process", action="store_true", help="정제 단계만 실행")
    parser.add_argument("--load", action="store_true", help="적재 단계만 실행")
    args = parser.parse_args()

    if args.collect:
        run_pipeline("collect")
    elif args.process:
        run_pipeline("process")
    elif args.load:
        run_pipeline("load")
    else:
        run_pipeline("all")


if __name__ == "__main__":
    main()
