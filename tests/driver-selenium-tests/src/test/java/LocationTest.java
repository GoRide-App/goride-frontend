// import org.junit.jupiter.api.Test;
// import org.openqa.selenium.By;
// import org.openqa.selenium.WebDriver;
// import org.openqa.selenium.support.ui.ExpectedConditions;

// import static org.junit.jupiter.api.Assertions.assertTrue;

// class LocationTest {

//     @Test
//     void locationControlsAreVisible() {
//         WebDriver driver =
//             DriverTestSupport.openAuthenticatedDriverPage();

//         try {
//             var wait = DriverTestSupport.waitFor(driver);

//             wait.until(
//                 ExpectedConditions.visibilityOfElementLocated(
//                     By.cssSelector("[data-testid='recenter-location']")
//                 )
//             );

//             assertTrue(
//                 driver.findElement(
//                     By.cssSelector("[data-testid='recenter-location']")
//                 ).isDisplayed()
//             );

//             assertTrue(
//                 driver.findElement(
//                     By.cssSelector("[data-testid='set-manual-location']")
//                 ).isDisplayed()
//             );

//         } finally {
//             driver.quit();
//         }
//     }
// }
