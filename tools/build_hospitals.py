"""동물병원 공공데이터(CSV) -> 앱용 JSON 변환 (개발 시 1회 실행)

입력: LOCALDATA 동물병원 전국 파일 (https://file.localdata.go.kr/file/animal_hospitals/info)
출력: data/hospitals.json  [{n:이름, a:주소, p:전화, y:위도, x:경도}, ...]
사용: python tools/build_hospitals.py tools/.hospitals_raw.csv
"""
import csv, io, json, sys
from pyproj import Transformer

# 중부원점TM(Bessel, EPSG:5174 계열) -> WGS84, 한국 표준 datum shift 적용
SRC = ("+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 "
       "+ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs")
tr = Transformer.from_crs(SRC, "EPSG:4326", always_xy=True)

raw = open(sys.argv[1], "rb").read()
text = raw.decode("utf-8-sig") if raw[:3] == b"\xef\xbb\xbf" else raw.decode("cp949")
rows = list(csv.DictReader(io.StringIO(text)))

out, skipped = [], 0
for r in rows:
    if r["영업상태명"] != "영업/정상":
        continue
    try:
        x, y = float(r["좌표정보(X)"]), float(r["좌표정보(Y)"])
    except ValueError:
        skipped += 1
        continue
    lng, lat = tr.transform(x, y)
    if not (33 <= lat <= 39 and 124 <= lng <= 132):  # 대한민국 범위 밖 = 좌표 오류
        skipped += 1
        continue
    out.append({
        "n": r["사업장명"].strip(),
        "a": (r["도로명주소"] or r["지번주소"]).strip(),
        "p": r["전화번호"].strip(),
        "y": round(lat, 5),
        "x": round(lng, 5),
    })

json.dump(out, open("data/hospitals.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"전체 {len(rows)} / 영업중 변환 {len(out)} / 좌표없음·오류 제외 {skipped}")
