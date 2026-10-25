import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

import static org.junit.jupiter.api.Assertions.assertTrue;

class DriverProfileTest {

    @Test
    void emptyProfileFormShowsValidationErrors() {
        WebDriver driver =
            DriverTestSupport.openAuthenticatedDriverPage();

        try {
            driver.get("http://localhost:3000/driver/profile");

            var wait = DriverTestSupport.waitFor(driver);

            wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector("input[placeholder='Toyota']")
                )
            );

            wait.until(
                ExpectedConditions.elementToBeClickable(
                    By.xpath("//button[@type='submit']")
                )
            ).click();

            wait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.xpath("//*[normalize-space()='Required']")
                )
            );

            assertTrue(
                driver.findElements(
                    By.xpath("//*[normalize-space()='Required']")
                ).size() > 0,
                "Expected required-field validation errors."
            );

        } finally {
            driver.quit();
        }
    }

    @Test
    void driverCanSelectCarVehicleType() {
        WebDriver driver =
            DriverTestSupport.openAuthenticatedDriverPage();

        try {
            driver.get("http://localhost:3000/driver/profile");

            var wait = DriverTestSupport.waitFor(driver);

            var carOption = wait.until(
                ExpectedConditions.elementToBeClickable(
                    By.xpath(
                        "//*[@role='radiogroup' and @aria-label='Vehicle type']" +
                        "//*[@role='radio' and .//span[normalize-space()='Car']]"
                    )
                )
            );

            carOption.click();

            wait.until(
                ExpectedConditions.attributeToBe(
                    carOption, "aria-checked", "true"
                )
            );

            assertTrue(
                carOption.isSelected()
                    || "true".equals(carOption.getAttribute("aria-checked")),
                "Car should be selected."
            );

        } finally {
            driver.quit();
        }
    }
}
