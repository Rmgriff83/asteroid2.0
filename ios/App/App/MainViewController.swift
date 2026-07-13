import Capacitor
import UIKit

/// Registers in-app plugins with the Capacitor bridge (Main.storyboard points
/// its view controller here instead of the stock CAPBridgeViewController).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetFeedPlugin())
    }
}
