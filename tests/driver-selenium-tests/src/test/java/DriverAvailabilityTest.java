// import org.junit.jupiter.api.Test;
// import org.openqa.selenium.By;
// import org.openqa.selenium.WebDriver;
// import org.openqa.selenium.support.ui.ExpectedConditions;

// import static org.junit.jupiter.api.Assertions.assertEquals;

// class DriverAvailabilityTest {

//     @Test
//     void driverCanToggleOnlineAndOffline() {
//         WebDriver driver =
//             DriverTestSupport.openAuthenticatedDriverPage();

//         try {
//             var wait = DriverTestSupport.waitFor(driver);

//             // This test assumes the initial state is Offline.
//             wait.until(
//                 ExpectedConditions.visibilityOfElementLocated(
//                     By.xpath(
//                         "//*[@role='status' and normalize-space()='Offline']"
//                     )
//                 )
//             );

//             wait.until(
//                 ExpectedConditions.elementToBeClickable(
//                     By.xpath("//button[normalize-space()='Go online']")
//                 )
//             ).click();

//             wait.until(
//                 ExpectedConditions.visibilityOfElementLocated(
//                     By.xpath(
//                         "//*[@role='status' and normalize-space()='Online']"
//                     )
//                 )
//             );

//             assertEquals(
//                 "Online",
//                 driver.findElement(
//                     By.xpath(
//                         "//*[@role='status' and normalize-space()='Online']"
//                     )
//                 ).getText()
//             );

//             wait.until(
//                 ExpectedConditions.elementToBeClickable(
//                     By.xpath("//button[normalize-space()='Go offline']")
//                 )
//             ).click();

//             wait.until(
//                 ExpectedConditions.visibilityOfElementLocated(
//                     By.xpath(
//                         "//*[@role='status' and normalize-space()='Offline']"
//                     )
//                 )
//             );

//         } finally {
//             driver.quit();
//         }
//     }
// }
