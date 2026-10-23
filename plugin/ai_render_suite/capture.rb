require 'tmpdir'
require 'fileutils'

module AIRenderSuite
  # Exports the active view for the AI: a shaded image, an optional
  # hidden-line pass, an optional transparent-background mask, and facts
  # about the camera and sun.
  module Capture
    LINE_STYLE = {
      'RenderMode' => 1, # hidden line
      'DrawGround' => false,
      'DrawHorizon' => false,
      'DisplayColorByLayer' => false
    }.freeze

    def self.run(opts)
      model = Sketchup.active_model
      raise 'Open a model first.' unless model
      view = model.active_view
      w, h = output_size(view, (opts['size'] || 1600).to_i)

      dir = Dir.mktmpdir('airs')
      result = {}
      begin
        view_path = File.join(dir, 'view.jpg')
        write(view, view_path, w, h)
        result['view'] = encode(view_path, 'image/jpeg', w, h)

        if opts['linePass']
          lines_path = File.join(dir, 'lines.png')
          with_temporary_style(model) { write(view, lines_path, w, h) }
          result['lines'] = encode(lines_path, 'image/png', w, h)
        end

        if opts['mask']
          mask_path = File.join(dir, 'mask.png')
          write(view, mask_path, w, h, transparent: true)
          result['mask'] = encode(mask_path, 'image/png', w, h)
        end

        result['facts'] = facts(model, view)
      ensure
        FileUtils.rm_rf(dir)
      end
      result
    end

    # Keeps the viewport's proportions, with the long side at `long_side` px.
    def self.output_size(view, long_side)
      long_side = [[long_side, 512].max, 4096].min
      vw = view.vpwidth.to_f
      vh = view.vpheight.to_f
      if vw >= vh
        [long_side, (long_side * vh / vw).round]
      else
        [(long_side * vw / vh).round, long_side]
      end
    end

    def self.write(view, path, w, h, transparent: false)
      ok = view.write_image(
        filename: path, width: w, height: h,
        antialias: true, compression: 0.9, transparent: transparent
      )
      raise 'SketchUp could not export the view.' unless ok && File.exist?(path)
    end

    def self.encode(path, mime, w, h)
      { 'mimeType' => mime, 'data' => [File.binread(path)].pack('m0'), 'width' => w, 'height' => h }
    end

    # Switches to a plain hidden-line look for one export, then puts every
    # setting back. Wrapped in an aborted operation so nothing lands in undo.
    def self.with_temporary_style(model)
      ro = model.rendering_options
      si = model.shadow_info
      keys = ro.keys
      saved = {}
      model.start_operation('AI Render Suite capture', true)
      begin
        LINE_STYLE.each do |k, v|
          next unless keys.include?(k)
          saved[k] = ro[k]
          ro[k] = v
        end
        shadows = si['DisplayShadows']
        si['DisplayShadows'] = false
        yield
      ensure
        saved.each { |k, v| ro[k] = v }
        si['DisplayShadows'] = shadows unless shadows.nil?
        model.abort_operation
      end
    end

    def self.facts(model, view)
      cam = view.camera
      si = model.shadow_info
      page = model.pages.selected_page
      out = {
        'perspective' => cam.perspective?,
        'modelName' => model.title,
        'sceneName' => page ? page.name : nil
      }
      out['focalLengthMm'] = focal_length(cam) if cam.perspective?
      t = si['ShadowTime']
      out['shadowTime'] = t.utc.strftime('%Y-%m-%dT%H:%M') if t.respond_to?(:strftime)
      out['northAngleDeg'] = si['NorthAngle'].to_f.round(1) unless si['NorthAngle'].nil?
      place = [si['City'], si['Country']].compact.map(&:to_s).reject(&:empty?)
      out['location'] = place.join(', ') unless place.empty?
      out
    end

    # 35 mm full-frame equivalent focal length, from SketchUp's field of view.
    def self.focal_length(cam)
      fov = cam.fov.to_f
      return nil unless fov > 0 && fov < 180
      vertical = cam.respond_to?(:fov_is_height?) ? cam.fov_is_height? : true
      sensor = vertical ? 24.0 : 36.0
      (sensor / (2.0 * Math.tan(fov * Math::PI / 360.0))).round
    end
  end
end
