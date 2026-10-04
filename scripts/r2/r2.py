"""Read-only R2 client (S3 SigV4, stdlib only). list [prefix] | get key out"""
import os, sys, hmac, hashlib, datetime, urllib.parse, urllib.request, ssl, xml.etree.ElementTree as ET, json
EP = os.environ.get("R2_ENDPOINT") or "https://2ab28c80faa4e6e48e1671865852cb45.r2.cloudflarestorage.com"
BUCKET = os.environ.get("R2_BUCKET_NAME") or "sabbath-classes-images"
AK, SK = os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"]
HOST = urllib.parse.urlparse(EP).netloc
CA = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
ctx = ssl.create_default_context(cafile=CA if os.path.exists(CA) else None)
def sign(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
def req(path, query):
    now = datetime.datetime.now(datetime.timezone.utc); amz = now.strftime("%Y%m%dT%H%M%SZ"); day = now.strftime("%Y%m%d")
    qs = "&".join(f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}" for k, v in sorted(query.items()))
    ph = hashlib.sha256(b"").hexdigest()
    canon = f"GET\n{path}\n{qs}\nhost:{HOST}\nx-amz-content-sha256:{ph}\nx-amz-date:{amz}\n\nhost;x-amz-content-sha256;x-amz-date\n{ph}"
    scope = f"{day}/auto/s3/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz}\n{scope}\n{hashlib.sha256(canon.encode()).hexdigest()}"
    k = sign(sign(sign(sign(("AWS4" + SK).encode(), day), "auto"), "s3"), "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    h = {"x-amz-date": amz, "x-amz-content-sha256": ph, "Authorization": f"AWS4-HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature={sig}"}
    return urllib.request.urlopen(urllib.request.Request(f"{EP}{path}" + (f"?{qs}" if qs else ""), headers=h), context=ctx, timeout=120)
def listall(prefix=""):
    tok = None; ns = "{http://s3.amazonaws.com/doc/2006-03-01/}"
    while True:
        q = {"list-type": "2", "max-keys": "1000", "prefix": prefix}
        if tok: q["continuation-token"] = tok
        root = ET.fromstring(req(f"/{BUCKET}", q).read())
        for c in root.findall(f"{ns}Contents"):
            yield c.find(f"{ns}Key").text, int(c.find(f"{ns}Size").text), c.find(f"{ns}LastModified").text
        if root.findtext(f"{ns}IsTruncated") != "true": break
        tok = root.findtext(f"{ns}NextContinuationToken")
if __name__ == "__main__":
    if sys.argv[1] == "list":
        for k, s, m in listall(sys.argv[2] if len(sys.argv) > 2 else ""): print(json.dumps([k, s, m]))
    elif sys.argv[1] == "get":
        key = urllib.parse.quote(sys.argv[2], safe="/-_.~")
        with req(f"/{BUCKET}/{key}", {}) as r, open(sys.argv[3], "wb") as f:
            while (b := r.read(1 << 20)): f.write(b)
