import WidgetKit

struct BaseEntry: TimelineEntry {
    let date: Date
    let base: WidgetBase?
    let frameFile: String?
}

/// One timeline entry per pre-rendered frame: WidgetKit swaps images on
/// schedule, so the window shows the surface as it actually looks at that
/// moment (day/night + weather are exact for each frame's timestamp).
struct BaseTimelineProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BaseEntry {
        BaseEntry(date: Date(), base: nil, frameFile: nil)
    }

    func snapshot(for configuration: SelectBaseIntent, in context: Context) async -> BaseEntry {
        entry(for: resolvedBase(configuration), at: Date())
    }

    func timeline(for configuration: SelectBaseIntent, in context: Context) async -> Timeline<BaseEntry> {
        let now = Date()
        guard let base = resolvedBase(configuration) else {
            // no feed yet: try again in a while (the app writes it on next open)
            return Timeline(
                entries: [BaseEntry(date: now, base: nil, frameFile: nil)],
                policy: .after(now.addingTimeInterval(30 * 60)))
        }
        var entries = [entry(for: base, at: now)]
        for frame in base.frames where frame.date > now {
            entries.append(BaseEntry(date: frame.date, base: base, frameFile: frame.file))
        }
        return Timeline(entries: entries, policy: .atEnd)
    }

    private func resolvedBase(_ configuration: SelectBaseIntent) -> WidgetBase? {
        let bases = WidgetFeedStore.loadManifest()?.bases ?? []
        if let picked = configuration.base {
            return bases.first { $0.panelKey == picked.id } ?? bases.first
        }
        return bases.first
    }

    private func entry(for base: WidgetBase?, at date: Date) -> BaseEntry {
        guard let base else { return BaseEntry(date: date, base: nil, frameFile: nil) }
        return BaseEntry(date: date, base: base, frameFile: base.frame(at: date)?.file)
    }
}
