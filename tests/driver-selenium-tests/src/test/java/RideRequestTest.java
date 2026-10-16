// import org.junit.jupiter.api.Test;
// import org.openqa.selenium.By;
// import org.openqa.selenium.WebDriver;
// import org.openqa.selenium.support.ui.ExpectedConditions;

// import static org.junit.jupiter.api.Assertions.assertTrue;

// class RideRequestTest {

//     @Test
//     void incomingRideOffersHaveActionButtons() {
//         WebDriver driver =
//             DriverTestSupport.openAuthenticatedDriverPage();

//         try {
//             var wait = DriverTestSupport.waitFor(driver);

//             // Requires a controlled incoming ride request to exist.
//             wait.until(
//                 ExpectedConditions.visibilityOfElementLocated(
//                     By.cssSelector("[data-testid='accept-ride']")
//                 )
//             );

//             assertTrue(
//                 driver.findElement(
//                     By.cssSelector("[data-testid='dismiss-ride']")
//                 ).isDisplayed(),
//                 "The dismiss action should be visible."
//             );

//         } finally {
//             driver.quit();
//         }
//     }
// }
