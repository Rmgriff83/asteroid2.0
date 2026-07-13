import Foundation

/// Read side of the widget feed the app writes into the App Group container.
/// Keep `appGroupId` in sync with App/WidgetFeedPlugin.swift (both embed the
/// placeholder bundle id — rename together before store submission).
enum WidgetFeedStore {
    static let appGroupId = "group.com.example.asteroidzen.widgets"

    static var feedDir: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
            .appendingPathComponent("widgets", isDirectory: true)
    }

    static func loadManifest() -> WidgetManifest? {
        guard
            let url = feedDir?.appendingPathComponent("manifest.json"),
            let data = try? Data(contentsOf: url)
        else { return nil }
        return try? JSONDecoder().decode(WidgetManifest.self, from: data)
    }

    static func frameURL(_ frame: WidgetFrame) -> URL? {
        feedDir?.appendingPathComponent(frame.file)
    }
}

struct WidgetManifest: Codable {
    let version: Int
    let generatedAtMs: Double
    let bases: [WidgetBase]
}

struct WidgetBase: Codable, Identifiable {
    let panelKey: String
    let baseId: String
    let name: String
    let resourceType: String
    let resourceName: String
    let colorHex: String
    let ratePerHour: Double
    let capacity: Double
    let lastCollected: Double
    let siloFullAt: Double
    let frames: [WidgetFrame]

    var id: String { panelKey }

    var lastCollectedDate: Date { Date(timeIntervalSince1970: lastCollected / 1000) }
    var siloFullDate: Date { Date(timeIntervalSince1970: siloFullAt / 1000) }

    /// mirror of src/game/systems/baseYield.js storedFor()
    func stored(at date: Date) -> Int {
        let hrs = date.timeIntervalSince(lastCollectedDate) / 3600
        return max(0, min(Int(capacity), Int(floor(hrs * ratePerHour))))
    }
}

struct WidgetFrame: Codable {
    let atMs: Double
    let file: String

    var date: Date { Date(timeIntervalSince1970: atMs / 1000) }
}

extension WidgetBase {
    /// the frame that best represents `date`: latest one at or before it
    func frame(at date: Date) -> WidgetFrame? {
        frames.filter { $0.date <= date }.last ?? frames.first
    }
}
