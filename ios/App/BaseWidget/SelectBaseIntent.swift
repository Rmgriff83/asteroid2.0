import AppIntents
import WidgetKit

/// Long-press → Edit Widget → pick which outpost this widget shows.
struct BaseEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Outpost"
    static var defaultQuery = BaseEntityQuery()

    var id: String // panelKey
    var name: String
    var resourceName: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(resourceName)")
    }

    static func from(_ base: WidgetBase) -> BaseEntity {
        BaseEntity(id: base.panelKey, name: base.name, resourceName: base.resourceName)
    }
}

struct BaseEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [BaseEntity] {
        (WidgetFeedStore.loadManifest()?.bases ?? [])
            .filter { identifiers.contains($0.panelKey) }
            .map(BaseEntity.from)
    }

    func suggestedEntities() async throws -> [BaseEntity] {
        (WidgetFeedStore.loadManifest()?.bases ?? []).map(BaseEntity.from)
    }

    func defaultResult() async -> BaseEntity? {
        (WidgetFeedStore.loadManifest()?.bases.first).map(BaseEntity.from)
    }
}

struct SelectBaseIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose Outpost"
    static var description = IntentDescription("Pick which base this widget watches.")

    @Parameter(title: "Outpost")
    var base: BaseEntity?
}
