import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public class DriverTestSupport {

    public static WebDriver openAuthenticatedDriverPage() {
        String username = System.getenv("GORIDE_TEST_USERNAME");
        String password = System.getenv("GORIDE_TEST_PASSWORD");

        if (username == null || username.isBlank()
                || password == null || password.isBlank()) {
            throw new IllegalStateException(
                "Set GORIDE_TEST_USERNAME and GORIDE_TEST_PASSWORD."
            );
        }

        WebDriver driver = new ChromeDriver();
        WebDriverWait wait =
            new WebDriverWait(driver, Duration.ofSeconds(30));

        try {
            driver.get("http://localhost:3000/driver");

            WebElement usernameField = wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "input[placeholder='Enter your identifier']"
                    )
                )
            );
            usernameField.sendKeys(username);

            wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "input[placeholder='Enter your password']"
                    )
                )
            ).sendKeys(password);

            wait.until(
                ExpectedConditions.elementToBeClickable(
                    By.xpath("//button[normalize-space()='Sign In']")
                )
            ).click();

            wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(
                        "section[aria-label='Availability']"
                    )
                )
            );

            return driver;
        } catch (RuntimeException e) {
            driver.quit();
            throw e;
        }
    }

    public static WebDriverWait waitFor(WebDriver driver) {
        return new WebDriverWait(driver, Duration.ofSeconds(15));
    }
}
