#!/usr/bin/env python3
"""
수출신고서(견본) vs 인보이스/패킹리스트 비교 도구
실행: python3 compare_docs.py
접속: http://localhost:5050
"""

import re
import io
from flask import Flask, request, render_template_string
import pdfplumber

app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>수출서류 비교</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; color: #222; }
  h1 { font-size: 1.2rem; font-weight: 600; padding: 20px 24px; background: #fff; border-bottom: 1px solid #e0e0e0; }
  .upload-area { display: flex; gap: 16px; padding: 24px; }
  .upload-box { flex: 1; background: #fff; border: 2px dashed #ccc; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: border-color .2s, background .2s; }
  .upload-box:hover { border-color: #555; }
  .upload-box.drag-over { border-color: #1565c0; background: #e3f2fd; }
  .upload-box label { display: block; cursor: pointer; }
  .upload-box input { display: none; }
  .upload-box .filename { margin-top: 8px; font-size: 0.85rem; color: #666; }
  .upload-box .icon { font-size: 2rem; margin-bottom: 8px; }
  .btn { display: block; width: calc(100% - 48px); margin: 0 24px 24px; padding: 12px; background: #222; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .btn:hover { background: #444; }
  .result { margin: 0 24px 24px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  th { background: #222; color: #fff; padding: 10px 14px; text-align: left; font-size: 0.85rem; }
  td { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .ok { color: #2e7d32; font-weight: 600; }
  .ng { color: #c62828; font-weight: 600; }
  .section-title { font-weight: 700; font-size: 0.95rem; padding: 16px 0 8px; }
  .error { background: #fff3f3; border: 1px solid #f5c6c6; border-radius: 8px; padding: 16px; color: #c62828; }
  .summary { display: flex; gap: 12px; margin-bottom: 16px; }
  .badge { padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
  .badge-ok { background: #e8f5e9; color: #2e7d32; }
  .badge-ng { background: #ffebee; color: #c62828; }
</style>
</head>
<body>
<h1>수출서류 비교 — 견본 vs 인보이스/패킹리스트</h1>
<form method="post" enctype="multipart/form-data">
  <div class="upload-area">
    <div class="upload-box" id="box-gyeonbon">
      <label>
        <div class="icon">📋</div>
        <strong>견본 (수출신고서)</strong><br>
        <small>클릭하거나 파일을 여기에 드래그</small>
        <input type="file" name="gyeonbon" id="input-gyeonbon" accept=".pdf" onchange="setName('gyeonbon', this.files[0])">
        <div class="filename" id="name-gyeonbon">{{ gyeonbon_name or '' }}</div>
      </label>
    </div>
    <div class="upload-box" id="box-invoice">
      <label>
        <div class="icon">📦</div>
        <strong>인보이스 / 패킹리스트</strong><br>
        <small>클릭하거나 파일을 여기에 드래그</small>
        <input type="file" name="invoice" id="input-invoice" accept=".pdf" onchange="setName('invoice', this.files[0])">
        <div class="filename" id="name-invoice">{{ invoice_name or '' }}</div>
      </label>
    </div>
  </div>
  <button class="btn" type="submit">비교하기</button>
</form>
<script>
function setName(key, file) {
  if (file) document.getElementById('name-' + key).textContent = file.name;
}

['gyeonbon', 'invoice'].forEach(function(key) {
  var box = document.getElementById('box-' + key);
  var input = document.getElementById('input-' + key);

  box.addEventListener('dragover', function(e) {
    e.preventDefault();
    box.classList.add('drag-over');
  });
  box.addEventListener('dragleave', function() {
    box.classList.remove('drag-over');
  });
  box.addEventListener('drop', function(e) {
    e.preventDefault();
    box.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (!file) return;
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    setName(key, file);
  });
});
</script>

{% if error %}
<div class="result"><div class="error">{{ error }}</div></div>
{% endif %}

{% if rows %}
<div class="result">
  <div class="summary">
    <span class="badge badge-ok">✅ 일치 {{ ok_count }}건</span>
    {% if ng_count > 0 %}<span class="badge badge-ng">❌ 불일치 {{ ng_count }}건</span>{% endif %}
  </div>
  <table>
    <thead><tr><th>항목</th><th>견본 (수출신고서)</th><th>인보이스/패킹리스트</th><th>결과</th></tr></thead>
    <tbody>
    {% for row in rows %}
      <tr>
        <td>{{ row.label }}</td>
        <td>{{ row.a }}</td>
        <td>{{ row.b }}</td>
        <td class="{{ 'ok' if row.match else 'ng' }}">{{ '✅' if row.match else '❌ 불일치' }}</td>
      </tr>
    {% endfor %}
    </tbody>
  </table>
</div>
{% endif %}
</body>
</html>
"""

def extract_text(pdf_bytes):
    text_pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text_pages.append(page.extract_text() or "")
    return "\n".join(text_pages)

def parse_gyeonbon(text):
    def find(pattern, default="—"):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else default

    invoice_no = find(r'39\s*송품장부호\s+(\S+)')
    buyer = find(r'4\s*구\s*매\s*자\s+(.+?)(?:\n|\(구매자부호\))')
    hs_code = find(r'35\s*세번부호\s+(\S+)')
    total_amount = find(r'총신고가격\s+\$?([\d,]+)')
    gross_weight = find(r'44\s*총중량\s+([\d.]+)\s*\(KG\)')
    total_pkg = find(r'45\s*총포장갯수\s+(\d+)')

    # 품목 파싱 (을지)
    items = []
    # 패턴: 품목명 수량(EA) 단가 금액
    item_pattern = re.finditer(
        r'\(NO:\s*\d+\)\s*\n([A-Z0-9_\- ]+?)\s+(\d+)\s*\(EA\)\s+([\d.]+)\s+([\d,]+)',
        text
    )
    for m in item_pattern:
        name = m.group(1).strip()
        qty = int(m.group(2))
        price = float(m.group(3))
        amount = int(m.group(4).replace(',', ''))
        items.append({'name': name, 'qty': qty, 'price': price, 'amount': amount})

    return {
        'invoice_no': invoice_no,
        'buyer': buyer.strip(),
        'hs_code': hs_code.replace('-', ' ').replace('.', ' '),
        'total_amount': total_amount.replace(',', ''),
        'gross_weight': gross_weight,
        'total_pkg': total_pkg,
        'items': items,
    }

def parse_invoice(text):
    def find(pattern, default="—"):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else default

    invoice_no = find(r'(\d{8}-\d{2})')
    buyer = find(r'2\)\s*Consignee\s*\n(.+?)(?:\n|$)')
    if buyer == "—":
        # packing list format: "2)Tel:..." then name
        buyer = find(r'2\).*?\n([A-Z].+?)(?:\n|$)')
    hs_code = find(r'(9031[\s.]+80[\s.]+9099)')
    total_amount = find(r'TOTAL\s+US\$\s*([\d,]+)')

    # Gross weight from packing list
    gross_weight = find(r'TOTAL\s+\d+\s+Boxes\s+([\d.]+)\s*KGS')
    total_pkg = find(r'TOTAL\s+(\d+)\s+Boxes')

    # 품목 파싱
    items = []
    # Invoice items: Name  QTY EA  US$PRICE  US$AMOUNT
    item_pattern = re.finditer(
        r'^([A-Za-z0-9_\- ]+?)\s+(\d+)\s+EA\s+US\$([\d.]+)\s+US\$([\d,]+)',
        text, re.MULTILINE
    )
    for m in item_pattern:
        name = m.group(1).strip().upper()
        qty = int(m.group(2))
        price = float(m.group(3))
        amount = int(m.group(4).replace(',', ''))
        items.append({'name': name, 'qty': qty, 'price': price, 'amount': amount})

    return {
        'invoice_no': invoice_no,
        'buyer': buyer.strip(),
        'hs_code': hs_code.replace('.', ' ').strip() if hs_code != "—" else "—",
        'total_amount': total_amount.replace(',', ''),
        'gross_weight': gross_weight,
        'total_pkg': total_pkg,
        'items': items,
    }

def normalize_hs(code):
    return re.sub(r'[\s.\-]', '', code)

def normalize_name(name):
    # 괄호 이후 제거 (담당자명, 결제조건 등)
    name = re.sub(r'\(.*', '', name)
    return re.sub(r'[\s_\-]', '', name.upper())

def compare(g, inv):
    rows = []

    def row(label, a, b, match_fn=None):
        if match_fn is None:
            match = str(a).strip() == str(b).strip()
        else:
            match = match_fn(a, b)
        rows.append({'label': label, 'a': a, 'b': b, 'match': match})

    row('인보이스 번호', g['invoice_no'], inv['invoice_no'])
    row('구매자', g['buyer'], inv['buyer'],
        lambda a, b: normalize_name(a) == normalize_name(b))
    row('HS Code', g['hs_code'], inv['hs_code'],
        lambda a, b: normalize_hs(a) == normalize_hs(b))
    row('총금액 (USD)', f"${g['total_amount']}", f"${inv['total_amount']}",
        lambda a, b: a.replace(',','') == b.replace(',',''))
    row('총중량 (Gross)', f"{g['gross_weight']} KG", f"{inv['gross_weight']} KG",
        lambda a, b: float(re.sub(r'[^\d.]', '', a)) == float(re.sub(r'[^\d.]', '', b)))
    row('포장 수량', f"{g['total_pkg']} CT/BOX", f"{inv['total_pkg']} BOX",
        lambda a, b: re.sub(r'[^\d]', '', a) == re.sub(r'[^\d]', '', b))

    # 품목 비교
    g_items = {normalize_name(i['name']): i for i in g['items']}
    inv_items = {normalize_name(i['name']): i for i in inv['items']}
    all_keys = sorted(set(list(g_items.keys()) + list(inv_items.keys())))

    for key in all_keys:
        gi = g_items.get(key)
        ii = inv_items.get(key)
        label_name = (gi or ii)['name']

        if gi and ii:
            row(f"{label_name} — 수량", str(gi['qty']), str(ii['qty']))
            row(f"{label_name} — 단가", f"${gi['price']}", f"${ii['price']}")
            row(f"{label_name} — 금액", f"${gi['amount']:,}", f"${ii['amount']:,}")
        elif gi:
            rows.append({'label': f"{label_name}", 'a': '있음', 'b': '없음', 'match': False})
        else:
            rows.append({'label': f"{label_name}", 'a': '없음', 'b': '있음', 'match': False})

    return rows

@app.route('/', methods=['GET', 'POST'])
def index():
    ctx = {}
    if request.method == 'POST':
        gb_file = request.files.get('gyeonbon')
        inv_file = request.files.get('invoice')
        if not gb_file or not inv_file or gb_file.filename == '' or inv_file.filename == '':
            ctx['error'] = '두 파일 모두 선택해주세요.'
        else:
            try:
                ctx['gyeonbon_name'] = gb_file.filename
                ctx['invoice_name'] = inv_file.filename
                gb_text = extract_text(gb_file.read())
                inv_text = extract_text(inv_file.read())
                g = parse_gyeonbon(gb_text)
                inv = parse_invoice(inv_text)
                rows = compare(g, inv)
                ctx['rows'] = rows
                ctx['ok_count'] = sum(1 for r in rows if r['match'])
                ctx['ng_count'] = sum(1 for r in rows if not r['match'])
            except Exception as e:
                ctx['error'] = f'파싱 오류: {e}'

    return render_template_string(HTML, **ctx)

if __name__ == '__main__':
    print("http://localhost:5050 에서 실행 중...")
    app.run(port=5050, debug=False)
