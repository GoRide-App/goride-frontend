
// import org.junit.jupiter.api.Test;
// import org.openqa.selenium.WebDriver;
// import org.openqa.selenium.chrome.ChromeDriver;

// import static org.junit.jupiter.api.Assertions.assertTrue;

// class DriverHomeTest {

//     @Test
//     void driverPageOpens() {
//         WebDriver driver = new ChromeDriver();

//         try {
//             driver.get("http://localhost:3000/driver");

//             String title = driver.getTitle();

//             System.out.println("Page title: " + title);

//             assertTrue(
//                 title != null && !title.isBlank(),
//                 "The browser should display a page title"
//             );
//         } finally {
//             driver.quit();
//         }
//     }


// }




import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertTrue;

class DriverHomeTest {

    @Test
    void driverCanLogInAndOpenHomePage() {
        String username = System.getenv("GORIDE_TEST_USERNAME");
        String password = System.getenv("GORIDE_TEST_PASSWORD");

        if (username == null || username.isBlank()
                || password == null || password.isBlank()) {
            throw new IllegalStateException(
                "Set GORIDE_TEST_USERNAME and GORIDE_TEST_PASSWORD first."
            );
        }

        WebDriver driver = new ChromeDriver();
        WebDriverWait wait =
            new WebDriverWait(driver, Duration.ofSeconds(30));

        try {
            // 1. Open the protected Driver page.
            driver.get("http://localhost:3000/driver");

            // 2. Wait for the Asgardeo username field.
            WebElement usernameField = wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "input[placeholder='Enter your identifier']"
                    )
                )
            );

            // 3. Enter test credentials.
            usernameField.sendKeys(username);

            WebElement passwordField = wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "input[placeholder='Enter your password']"
                    )
                )
            );

            passwordField.sendKeys(password);

            // 4. Submit the login form.
            wait.until(
                ExpectedConditions.elementToBeClickable(
                    By.xpath(
                        "//button[normalize-space()='Sign In']"
                    )
                )
            ).click();

            // 5. Wait until authentication redirects to GoRide.
            wait.until(d -> {
                String url = d.getCurrentUrl();
                return url.startsWith("http://localhost:3000/");
            });

            System.out.println(
                "After login URL: " + driver.getCurrentUrl()
            );

            // 6. Verify the actual Driver page is rendered.
            WebElement availability = wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "section[aria-label='Availability']"
                    )
                )
            );

            assertTrue(
                availability.isDisplayed(),
                "Driver availability section should be visible."
            );

            System.out.println(
                "PASS: Driver page loaded after login."
            );

        } finally {
            driver.quit();
        }
    }
}

