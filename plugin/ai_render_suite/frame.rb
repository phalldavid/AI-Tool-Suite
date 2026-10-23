module AIRenderSuite
  # The render frame: a fixed aspect ratio shown in the SketchUp viewport as
  # a dimmed border (an overlay, SketchUp 2023 and newer), and used to crop
  # every capture so the render matches what the frame showed.
  module Frame
    @ratio = nil # nil = whole viewport
    @visible = true

    class << self
      attr_reader :ratio
      attr_accessor :visible
    end

    # Frame rectangle in viewport pixels: the largest rectangle of the
    # chosen ratio that fits the viewport, centred. Same rule as the panel.
    def self.rect(width, height, ratio = @ratio)
      width = width.to_f
      height = height.to_f
      return [0.0, 0.0, width, height] unless ratio && ratio > 0
      if width / height > ratio
        w = height * ratio
        [(width - w) / 2.0, 0.0, w, height]
      else
        h = width / ratio
        [0.0, (height - h) / 2.0, width, h]
      end
    end

    def self.set(ratio, visible)
      @ratio = ratio && ratio.to_f > 0 ? ratio.to_f : nil
      @visible = visible ? true : false
      install(Sketchup.active_model)
      Sketchup.active_model.active_view.invalidate if Sketchup.active_model
      { 'overlay' => overlays_supported? }
    end

    def self.overlays_supported?
      defined?(Sketchup::Overlay) ? true : false
    end

    def self.install(model)
      return unless model && overlays_supported?
      @installed ||= {}
      key = model.object_id
      overlay = @installed[key]
      unless overlay
        overlay = FrameOverlay.new
        model.overlays.add(overlay)
        @installed[key] = overlay
      end
      overlay.enabled = true if overlay.respond_to?(:enabled=)
    rescue StandardError => e
      puts "David Render Studio: could not add the frame overlay (#{e.message})"
    end

    if defined?(Sketchup::Overlay)
      class FrameOverlay < Sketchup::Overlay
        SHADE = Sketchup::Color.new(12, 14, 18, 150)
        EDGE = Sketchup::Color.new(255, 255, 255, 220)

        def initialize
          super('airs.render_frame', 'David Render Studio frame',
                description: 'Shows the aspect ratio that AI renders will use.')
        end

        def draw(view)
          return unless Frame.visible && Frame.ratio
          vw = view.vpwidth.to_f
          vh = view.vpheight.to_f
          x, y, w, h = Frame.rect(vw, vh)
          pt = ->(a, b) { Geom::Point3d.new(a, b, 0) }
          view.drawing_color = SHADE
          if x > 0.5
            view.draw2d(GL_QUADS, [pt[0, 0], pt[x, 0], pt[x, vh], pt[0, vh]])
            view.draw2d(GL_QUADS, [pt[x + w, 0], pt[vw, 0], pt[vw, vh], pt[x + w, vh]])
          end
          if y > 0.5
            view.draw2d(GL_QUADS, [pt[0, 0], pt[vw, 0], pt[vw, y], pt[0, y]])
            view.draw2d(GL_QUADS, [pt[0, y + h], pt[vw, y + h], pt[vw, vh], pt[0, vh]])
          end
          view.line_width = 1
          view.drawing_color = EDGE
          view.draw2d(GL_LINE_LOOP, [pt[x, y], pt[x + w, y], pt[x + w, y + h], pt[x, y + h]])
          # Thirds, faint, to help composition.
          view.drawing_color = Sketchup::Color.new(255, 255, 255, 60)
          [1, 2].each do |i|
            view.draw2d(GL_LINES, [pt[x + w * i / 3.0, y], pt[x + w * i / 3.0, y + h]])
            view.draw2d(GL_LINES, [pt[x, y + h * i / 3.0], pt[x + w, y + h * i / 3.0]])
          end
        end
      end
    end

    class ModelWatcher < Sketchup::AppObserver
      def onNewModel(model)
        Frame.install(model)
      end

      def onOpenModel(model)
        Frame.install(model)
      end
    end
  end
end
