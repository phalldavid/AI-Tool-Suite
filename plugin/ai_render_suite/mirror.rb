require 'json'
require 'fileutils'

module AIRenderSuite
  # Mirror reflections: pick a mirror face, SketchUp renders the room from
  # the mirror's position, and that image is laid onto the mirror as a
  # texture. The AI render then sees a real reflection to work from.
  module Mirror
    LIFT = 1.0 # mm off the mirror face
    CAMERA_OFFSET = 10.0 # mm in front of the mirror
    LONG_SIDE = 1400 # px of the reflection image

    def self.start_pick_tool(settings)
      Sketchup.active_model.select_tool(PickTool.new(settings))
      nil
    end

    # Mirror rectangle in world space from a picked face.
    def self.rect_from_face(face, tr, view)
      pts = face.outer_loop.vertices.map { |v| v.position.transform(tr) }
      center = Geom::Point3d.new(
        pts.sum(&:x) / pts.length, pts.sum(&:y) / pts.length, pts.sum(&:z) / pts.length
      )
      normal = Lights.facing_camera(Lights.world_normal(face, tr), center, view)
      up = Lights.in_plane(Geom::Vector3d.new(0, 0, 1), normal)
      up = Lights.in_plane(view.camera.up, normal) if up.length < 0.2
      right = normal * up
      right.normalize!
      us = pts.map { |p| (p - center) % right }
      vs = pts.map { |p| (p - center) % up }
      mid = center.offset(right, (us.min + us.max) / 2.0).offset(up, (vs.min + vs.max) / 2.0)
      {
        'center' => mid.to_a, 'normal' => normal.to_a, 'up' => up.to_a,
        'width' => (us.max - us.min).to_f, 'height' => (vs.max - vs.min).to_f
      }
    end

    def self.create(view, face, tr, settings)
      raise 'That face is too small to be a mirror.' if face.area < 1.0 # square inches
      rect = rect_from_face(face, tr, view)
      model = Sketchup.active_model
      model.start_operation('Add AI mirror reflection', true)
      begin
        group = model.entities.add_group
        group.layer = Lights.tag(model)
        group.name = 'AI Mirror reflection'
        group.casts_shadows = false
        group.set_attribute(Lights::DICT, 'type', 'mirror')
        group.set_attribute(Lights::DICT, 'rect', JSON.generate(rect))
        group.set_attribute(Lights::DICT, 'settings', JSON.generate(settings))
        refresh(group)
        model.commit_operation
      rescue StandardError
        model.abort_operation
        raise
      end
      Bridge.notify('lightsChanged', Lights.summary(model))
      true
    end

    # Re-renders the reflection for one mirror group (after the room changed).
    def self.refresh(group)
      model = Sketchup.active_model
      view = model.active_view
      rect = JSON.parse(group.get_attribute(Lights::DICT, 'rect'))
      settings = JSON.parse(group.get_attribute(Lights::DICT, 'settings') || '{}')
      center = Geom::Point3d.new(rect['center'])
      normal = Geom::Vector3d.new(rect['normal'])
      up = Geom::Vector3d.new(rect['up'])
      right = normal * up
      right.normalize!
      w = rect['width'].to_f
      h = rect['height'].to_f
      aspect = w / h

      path = render_reflection(model, view, group, center, normal, up, aspect, settings)
      mat = model.materials.add("AIRS Mirror #{group.persistent_id}")
      mat.texture = path

      group.entities.clear!
      c = center.offset(normal, LIFT.mm)
      bl = c.offset(right, -w / 2.0).offset(up, -h / 2.0)
      br = c.offset(right, w / 2.0).offset(up, -h / 2.0)
      tr_pt = c.offset(right, w / 2.0).offset(up, h / 2.0)
      tl = c.offset(right, -w / 2.0).offset(up, h / 2.0)
      f = group.entities.add_face(bl, br, tr_pt, tl)
      # Camera-right is world `right`, so the image maps without flipping:
      # something to the mirror's right shows on the mirror's right.
      f.position_material(mat, [bl, [0, 0], br, [1, 0], tr_pt, [1, 1]], true)
      Lights.finish_face(f, normal)
    end

    def self.render_reflection(model, view, group, center, normal, up, aspect, settings)
      eye = center.offset(normal, CAMERA_OFFSET.mm)
      target = eye.offset(normal, 1000.mm)
      fov = settings['fov'].to_f
      fov = 60.0 unless fov > 10 && fov < 120

      old = view.camera
      saved = [old.eye, old.target, old.up, old.perspective?, old.perspective? ? old.fov : old.height]
      saved_aspect = old.aspect_ratio
      frame_visible = Frame.visible
      was_hidden = group.hidden?
      FileUtils.mkdir_p(File.join(Store.folder, 'mirrors'))
      path = File.join(Store.folder, 'mirrors', "mirror_#{group.persistent_id}_#{Time.now.to_i}.jpg")
      begin
        group.hidden = true
        Frame.visible = false
        cam = Sketchup::Camera.new(eye, target, up, true, fov)
        cam.aspect_ratio = aspect
        view.camera = cam
        pw, ph = aspect >= 1 ? [LONG_SIDE, (LONG_SIDE / aspect).round] : [(LONG_SIDE * aspect).round, LONG_SIDE]
        ok = view.write_image(filename: path, width: pw, height: ph, antialias: true, compression: 0.9)
        raise 'SketchUp could not render the reflection.' unless ok
      ensure
        back = Sketchup::Camera.new(saved[0], saved[1], saved[2], saved[3], saved[3] ? saved[4] : 30)
        back.height = saved[4] unless saved[3]
        back.aspect_ratio = saved_aspect
        view.camera = back
        group.hidden = was_hidden
        Frame.visible = frame_visible
      end
      path
    end

    def self.mirror_groups(model)
      Lights.groups(model).select { |g| g.get_attribute(Lights::DICT, 'type') == 'mirror' }
    end

    def self.refresh_all
      model = Sketchup.active_model
      groups = mirror_groups(model)
      raise 'There are no AI mirrors in this model yet.' if groups.empty?
      model.start_operation('Update AI mirror reflections', true)
      begin
        groups.each { |g| refresh(g) }
        model.commit_operation
      rescue StandardError
        model.abort_operation
        raise
      end
      groups.length
    end

    class PickTool
      def initialize(settings)
        @settings = settings
        @ip = Sketchup::InputPoint.new
      end

      def activate
        Sketchup.status_text = 'AI mirror: click the mirror face (or glass, TV screen, polished panel). Esc to cancel.'
      end

      def onMouseMove(_flags, x, y, view)
        @ip.pick(view, x, y)
        view.invalidate
      end

      def draw(view)
        face = @ip.valid? ? @ip.face : nil
        return unless face
        tr = @ip.transformation
        pts = face.outer_loop.vertices.map { |v| v.position.transform(tr) }
        view.drawing_color = Sketchup::Color.new(80, 160, 255)
        view.line_width = 3
        view.draw(GL_LINE_LOOP, pts)
      end

      def onLButtonDown(_flags, x, y, view)
        @ip.pick(view, x, y)
        face = @ip.face
        return UI.beep unless face
        begin
          Mirror.create(view, face, @ip.transformation, @settings)
        rescue StandardError => e
          UI.messagebox("AI mirror: #{e.message}")
        end
        Sketchup.active_model.select_tool(nil)
      end

      def onCancel(_reason, _view)
        Sketchup.active_model.select_tool(nil)
      end
    end
  end
end
