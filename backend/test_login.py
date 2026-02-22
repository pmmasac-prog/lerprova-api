import requests

def test_login():
    url = "http://localhost:8000/auth/login"
    data = {
        "email": "admin@lerprova.com.br",
        "password": "admin"
    }
    print(f"Testing login at {url}...")
    try:
        response = requests.post(url, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
