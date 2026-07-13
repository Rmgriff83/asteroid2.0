import Capacitor
import Foundation
import WidgetKit

/// In-app Capacitor plugin: receives pre-rendered widget frames + manifest
/// from the web layer and stores them in the App Group container where the
/// BaseWidget extension reads them.
///
/// NOTE: the group id embeds the (placeholder) bundle id — keep in sync with
/// BaseWidget/WidgetManifest.swift and rename both before store submission.
@objc(WidgetFeedPlugin)
public class WidgetFeedPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetFeedPlugin"
    public let jsName = "WidgetFeed"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise),
    ]

    static let appGroupId = "group.com.example.asteroidzen.widgets"

    private func feedDir() -> URL {
        let container =
            FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroupId)
            // unsigned dev builds have no App Group — fall back so the app still runs
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = container.appendingPathComponent("widgets", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    @objc func write(_ call: CAPPluginCall) {
        let root = feedDir()
        do {
            for entry in call.getArray("files", JSObject.self) ?? [] {
                guard
                    let rel = entry["path"] as? String, !rel.contains(".."),
                    let b64 = entry["dataB64"] as? String,
                    let bytes = Data(base64Encoded: b64)
                else { continue }
                let out = root.appendingPathComponent(rel)
                try FileManager.default.createDirectory(
                    at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
                try bytes.write(to: out)
            }
            if let manifestJson = call.getString("manifestJson") {
                // manifest written last + atomically: the widget never sees a half feed
                let manifestURL = root.appendingPathComponent("manifest.json")
                try Data(manifestJson.utf8).write(to: manifestURL, options: .atomic)
                pruneStaleBaseDirs(root: root, manifestJson: manifestJson)
            }
            call.resolve()
        } catch {
            call.reject("widget feed write failed: \(error.localizedDescription)")
        }
    }

    @objc func reloadWidgets(_ call: CAPPluginCall) {
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    private func pruneStaleBaseDirs(root: URL, manifestJson: String) {
        guard
            let data = manifestJson.data(using: .utf8),
            let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let bases = manifest["bases"] as? [[String: Any]]
        else { return }
        let keep = Set(
            bases.compactMap { ($0["panelKey"] as? String).map { "b_" + $0.replacingOccurrences(of: ",", with: "_") } }
        )
        let children =
            (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey]))
            ?? []
        for child in children where child.lastPathComponent.hasPrefix("b_") {
            if !keep.contains(child.lastPathComponent) {
                try? FileManager.default.removeItem(at: child)
            }
        }
    }
}
