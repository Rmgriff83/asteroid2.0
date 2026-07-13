import SwiftUI
import WidgetKit

@main
struct BaseWidgetBundle: WidgetBundle {
    var body: some Widget {
        BaseWidget()
    }
}

/// The base-window widget: a full-width live view of one outpost — the
/// pre-rendered surface (accurate day/night + weather per frame timestamp),
/// silo fill, and a tap straight into that base.
struct BaseWidget: Widget {
    let kind = "BaseWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectBaseIntent.self,
            provider: BaseTimelineProvider()
        ) { entry in
            BaseWidgetView(entry: entry)
        }
        .configurationDisplayName("Base Window")
        .description("The view from one of your outposts, live silo included.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}
