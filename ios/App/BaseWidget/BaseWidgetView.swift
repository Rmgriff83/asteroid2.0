import SwiftUI
import WidgetKit

struct BaseWidgetView: View {
    var entry: BaseEntry

    var body: some View {
        Group {
            if let base = entry.base {
                baseView(base)
                    .widgetURL(URL(string: "deepfield://base/\(base.panelKey)"))
            } else {
                emptyView
            }
        }
        .containerBackground(Color(red: 0.02, green: 0.03, blue: 0.05), for: .widget)
    }

    private func baseView(_ base: WidgetBase) -> some View {
        ZStack(alignment: .bottom) {
            frameImage
            // bottom scrim for legibility over the scene
            LinearGradient(
                colors: [.clear, Color.black.opacity(0.65)],
                startPoint: .center, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(base.resourceName.uppercased()) \(base.stored(at: entry.date))/\(Int(base.capacity))")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color(hex: base.colorHex))
                    Spacer()
                    if base.siloFullDate > entry.date {
                        // auto-ticking countdown — no timeline refresh needed
                        HStack(spacing: 4) {
                            Text("FULL")
                            Text(timerInterval: entry.date...base.siloFullDate, countsDown: true)
                        }
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.65))
                    } else {
                        Text("SILO FULL")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color(hex: "#7dffd8"))
                    }
                }
                // silo fill that keeps filling between refreshes
                ProgressView(
                    timerInterval: base.lastCollectedDate...base.siloFullDate,
                    countsDown: false, label: { EmptyView() },
                    currentValueLabel: { EmptyView() }
                )
                .progressViewStyle(.linear)
                .tint(Color(hex: base.colorHex))
                .frame(height: 4)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 9)

            VStack {
                HStack {
                    Text(base.name.uppercased())
                        .font(.system(size: 10, design: .monospaced))
                        .kerning(2)
                        .foregroundStyle(.white.opacity(0.8))
                        .shadow(color: .black, radius: 3)
                    Spacer()
                }
                Spacer()
            }
            .padding(10)
        }
    }

    @ViewBuilder
    private var frameImage: some View {
        if let file = entry.frameFile,
           let url = WidgetFeedStore.frameURL(WidgetFrame(atMs: 0, file: file)),
           let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            LinearGradient(
                colors: [Color(hex: "#0b0e14"), Color(hex: "#2c2822")],
                startPoint: .top, endPoint: .bottom)
        }
    }

    private var emptyView: some View {
        VStack(spacing: 6) {
            Text("DEEPFIELD")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .kerning(3)
                .foregroundStyle(Color(hex: "#7dffd8"))
            Text("OPEN THE APP TO SYNC YOUR OUTPOSTS")
                .font(.system(size: 9, design: .monospaced))
                .foregroundStyle(.white.opacity(0.5))
        }
    }
}

extension Color {
    init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: String(hex.dropFirst())).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255)
    }
}
