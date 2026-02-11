from playwright.sync_api import sync_playwright
import time

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 412, 'height': 915} # Mobile size
        )

        # Inject Mock User
        mock_user = {
            "id": "USER123",
            "name": "Test Student",
            "role": "STUDENT",
            "credits": 500,
            "streak": 5,
            "mcqHistory": [
                {"id": "1", "score": 80, "totalQuestions": 100, "date": "2023-10-01", "chapterTitle": "Test 1", "subjectName": "Math"},
                {"id": "2", "score": 90, "totalQuestions": 100, "date": "2023-10-02", "chapterTitle": "Test 2", "subjectName": "Science"}
            ],
            "isPremium": True,
            "subscriptionLevel": "ULTRA"
        }

        page = context.new_page()

        # Go to home and inject storage
        page.goto("http://localhost:5000/")
        page.evaluate(f"localStorage.setItem('nst_current_user', '{str(mock_user).replace(chr(39), chr(34))}');")
        page.reload()

        time.sleep(2) # Wait for load

        # Take Screenshot of Home
        page.screenshot(path="verification_home.png")
        print("Captured Home Screenshot")

        # Open Sidebar
        # There is a button with List icon in the header
        # I'll try to click the first button in header which should be the menu
        try:
             page.locator("button").first.click()
             time.sleep(1)
             page.screenshot(path="verification_sidebar.png")
             print("Captured Sidebar Screenshot")
        except Exception as e:
             print(f"Sidebar failed: {e}")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
