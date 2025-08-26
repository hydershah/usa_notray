import json


def test_health_check():
    url = "http://localhost/health"
    status = None
    body = None
    # Try using requests if available, otherwise fallback to urllib
    try:
        import requests
        try:
            resp = requests.get(url, timeout=5)
            status = resp.status_code
            # Keep body as text for diagnostic messages
            body = resp.text
        except Exception as e:
            assert False, f"HTTP request using requests failed: {e}"
    except Exception:
        # Fallback to urllib
        try:
            import urllib.request
            with urllib.request.urlopen(url, timeout=5) as r:
                status = r.getcode()
                body = r.read().decode(errors='replace')
        except Exception as e:
            assert False, f"HTTP request using urllib failed: {e}"

    assert status == 200, f"Expected HTTP 200 from {url}, got {status}. Body: {body}"
    print(f"Health check passed: {status}")


# Execute the test
if __name__ == '__main__':
    test_health_check()