"""
ScanPang Data Pipeline - 설정 모듈
환경변수 로드 및 DB 연결 정보, API 키 관리
"""

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

# .env 파일 로드 (data-pipeline 디렉토리 기준)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

# ──────────────────────────────────────────────
# 공공데이터포털 API
# ──────────────────────────────────────────────
DATA_GO_KR_API_KEY: str = os.getenv("DATA_GO_KR_API_KEY", "")

# ──────────────────────────────────────────────
# 네이버 검색 / Geocoding API
# ──────────────────────────────────────────────
NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")

# ──────────────────────────────────────────────
# Google Places API
# ──────────────────────────────────────────────
GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "")

# ──────────────────────────────────────────────
# PostgreSQL (Supabase)
# ──────────────────────────────────────────────
# DATABASE_URL에 특수문자($, ?, @, & 등)가 포함되어 있으므로
# .env 파일에서 직접 파싱하여 개별 파라미터로 연결한다.
DATABASE_URL_RAW: str = os.getenv("DATABASE_URL", "")

# DATABASE_URL 특수문자 문제를 우회하기 위해 개별 연결 파라미터 정의
# .env의 DATABASE_URL을 직접 파싱하기 어려우므로 명시적으로 분리
DB_HOST: str = os.getenv("DB_HOST", "db.xnlxiolkjysfzwzsejqh.supabase.co")
DB_PORT: str = os.getenv("DB_PORT", "5432")
DB_NAME: str = os.getenv("DB_NAME", "postgres")
DB_USER: str = os.getenv("DB_USER", "postgres")
# 비밀번호에 특수문자($F?Fsz7c@&KMa/8)가 포함되어 있어
# dotenv가 올바르게 파싱하지 못할 수 있으므로 .env 파일을 직접 읽어서 추출
DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")


def _parse_password_from_env() -> str:
    """
    .env 파일에서 DATABASE_URL의 비밀번호를 직접 파싱한다.
    형식: postgresql://user:password@host:port/dbname
    비밀번호에 @가 포함되어 있으므로 마지막 @를 기준으로 분리한다.
    """
    try:
        with open(_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    url = line[len("DATABASE_URL="):]
                    # postgresql://postgres:PASSWORD@host:port/db
                    # 'postgres:' 뒤부터 마지막 '@' 앞까지가 비밀번호
                    after_scheme = url.split("://", 1)[1]  # postgres:PASSWORD@host:port/db
                    # 마지막 '@'를 기준으로 분리 (비밀번호 안에 @가 있을 수 있음)
                    last_at = after_scheme.rfind("@")
                    user_pass = after_scheme[:last_at]  # postgres:PASSWORD
                    password = user_pass.split(":", 1)[1]  # PASSWORD
                    return password
    except Exception:
        pass
    return ""


def get_db_password() -> str:
    """DB 비밀번호를 반환한다. 환경변수 우선, 없으면 .env 파일에서 직접 파싱."""
    if DB_PASSWORD:
        return DB_PASSWORD
    return _parse_password_from_env()


def get_db_params() -> dict:
    """psycopg2.connect()에 전달할 연결 파라미터 딕셔너리를 반환한다."""
    return {
        "host": DB_HOST,
        "port": int(DB_PORT),
        "dbname": DB_NAME,
        "user": DB_USER,
        "password": get_db_password(),
    }


def get_db_url_safe() -> str:
    """SQLAlchemy 등에서 사용할 수 있는 안전한 DATABASE_URL을 반환한다."""
    password_encoded = quote_plus(get_db_password())
    return f"postgresql://{DB_USER}:{password_encoded}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


# ──────────────────────────────────────────────
# 수집 대상 지역 설정
# ──────────────────────────────────────────────
# 강남구 역삼동 법정동코드
SIGUNGU_CD = "11680"       # 강남구
BJDONG_CD = "10300"        # 역삼동

# 강남역/역삼역 중심 좌표 (WGS84)
TARGET_CENTER_LAT = 37.4979
TARGET_CENTER_LNG = 127.0276
TARGET_RADIUS_M = 500      # 반경 500m

# 수집 대상 주요 건물 키워드 (강남역·역삼역 반경 500m)
TARGET_BUILDING_KEYWORDS = [
    "강남파이낸스센터",
    "역삼역",
    "테헤란로",
    "강남역",
    "GT타워",
    "삼성타운",
    "강남빌딩",
    "역삼동",
    "스타플렉스",
    "아크플레이스",
    "메리츠타워",
    "신논현역",
]
