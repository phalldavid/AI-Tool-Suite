require 'json'
require 'fileutils'

module AIRenderSuite
  # Light previews placed in the model: spotlight beams on walls and LED
  # glow strips along edges. They are flat textured faces on their own tag,
  # with no shadows, so the AI render reads them as real light fixtures.
  #
  # The panel draws each texture (beam shape, colour temperature,
  # intensity) and sends it here as a PNG.
  module Lights
    TAG = 'AI Lights'.freeze
    DICT = 'airs_light'.freeze
    LIFT = 1.5 # mm off the surface, to avoid flicker
    ROTATION = { 'down' => 0, 'right' => 90, 'up' => 180, 'left' => -90 }.freeze

    def self.tag(model)
      model.layers[TAG] || model.layers.add(TAG)
    end

    def self.texture_folder
      File.join(Store.folder, 'textures')
    end

    # Writes the PNG from the panel and returns a material using it.
    def self.material(model, texture_id, data, label)
      id = texture_id.to_s.gsub(/[^\w\-]/, '')[0, 60]
      raise 'Missing light texture.' if id.empty? || data.to_s.empty?
      FileUtils.mkdir_p(texture_folder)
      path = File.join(texture_folder, "#{id}.png")
      File.binwrite(path, data.unpack1('m')) unless File.exist?(path)
      name = "AIRS #{label} #{id}"
      mat = model.materials[name]
      return mat if mat
      mat = model.materials.add(name)
      mat.texture = path
      mat
    end

    def self.world_normal(face, tr)
      n = face.normal.transform(tr)
      n.normalize!
      n
    end

    # Normal flipped to the side the camera sees.
    def self.facing_camera(normal, point, view)
      to_eye = view.camera.eye - point
      normal.reverse! if to_eye.length > 0 && to_eye % normal < 0
      normal
    end

    # Component of `vector` that lies in the plane with normal `normal`.
    def self.in_plane(vector, normal)
      v = vector - Geom::Vector3d.linear_combination(vector % normal, normal, 0, normal)
      v.length > 1e-6 ? v.normalize : v
    end

    def self.finish_face(face, normal)
      face.reverse! if face.normal % normal < 0
      face.edges.each { |e| e.hidden = true }
      face.casts_shadows = false
      face.receives_shadows = false
    end

    def self.light_group(model, type, settings)
      group = model.entities.add_group
      group.layer = tag(model)
      group.name = type == 'spot' ? 'AI Spotlight' : 'AI LED strip'
      group.casts_shadows = false
      group.set_attribute(DICT, 'type', type)
      group.set_attribute(DICT, 'kelvin', settings['kelvin'].to_i)
      group.set_attribute(DICT, 'settings', JSON.generate(settings))
      group
    end

    # ---------- spotlights ----------

    def self.start_spot_tool(settings, texture)
      model = Sketchup.active_model
      mat = material(model, texture['id'], texture['data'], 'Spot')
      model.select_tool(SpotTool.new(settings, mat))
      nil
    end

    def self.create_spot(view, point, face, tr, settings, mat)
      model = Sketchup.active_model
      normal = facing_camera(world_normal(face, tr), point, view)
      down = in_plane(Geom::Vector3d.new(0, 0, -1), normal)
      down = in_plane(view.camera.direction, normal) if down.length < 0.2 # ceilings and floors
      return false if down.length < 0.2
      angle = ROTATION.fetch(settings['orientation'].to_s, 0)
      down = down.transform(Geom::Transformation.rotation(ORIGIN, normal, angle.degrees)) if angle != 0
      right = down * normal
      right.normalize!

      length = settings['lengthMm'].to_f.clamp(100, 5000).mm
      width = settings['widthMm'].to_f.clamp(100, 5000).mm
      top = point.offset(normal, LIFT.mm)
      tl = top.offset(right, -width / 2.0)
      tr_pt = top.offset(right, width / 2.0)
      br = tr_pt.offset(down, length)
      bl = tl.offset(down, length)

      model.start_operation('Add AI spotlight', true)
      begin
        group = light_group(model, 'spot', settings)
        f = group.entities.add_face(tl, tr_pt, br, bl)
        f.position_material(mat, [tl, [0, 1], tr_pt, [1, 1], br, [1, 0]], true)
        finish_face(f, normal)
        model.commit_operation
      rescue StandardError
        model.abort_operation
        raise
      end
      true
    end

    class SpotTool
      def initialize(settings, material)
        @settings = settings
        @material = material
        @ip = Sketchup::InputPoint.new
        @count = 0
      end

      def activate
        status
      end

      def status
        Sketchup.status_text = "AI spotlight: click a wall or ceiling where the light sits. #{@count} placed. Esc to finish."
      end

      def onMouseMove(_flags, x, y, view)
        @ip.pick(view, x, y)
        view.tooltip = @ip.tooltip if @ip.valid?
        view.invalidate
      end

      def draw(view)
        @ip.draw(view) if @ip.valid? && @ip.display?
      end

      def onLButtonDown(_flags, x, y, view)
        @ip.pick(view, x, y)
        face = @ip.face
        unless face
          UI.beep
          return
        end
        if Lights.create_spot(view, @ip.position, face, @ip.transformation, @settings, @material)
          @count += 1
          status
          Bridge.notify('lightsChanged', Lights.summary(Sketchup.active_model))
        end
      end

      def onCancel(_reason, _view)
        Sketchup.active_model.select_tool(nil)
      end

      def deactivate(view)
        view.invalidate
      end
    end

    # ---------- LED strips ----------

    def self.add_leds(settings, texture)
      model = Sketchup.active_model
      view = model.active_view
      tr = model.edit_transform
      edges = model.selection.grep(Sketchup::Edge)
      raise 'Select one or more edges first (a cove, shelf edge, mirror edge or step), then press Add LED.' if edges.empty?
      mat = material(model, texture['id'], texture['data'], 'LED')
      width = settings['widthMm'].to_f.clamp(20, 2000).mm

      model.start_operation('Add AI LED strip', true)
      begin
        group = light_group(model, 'led', settings)
        edges.each { |e| led_ribbons(group.entities, view, e, tr, width, mat) }
        model.commit_operation
      rescue StandardError
        model.abort_operation
        raise
      end
      Bridge.notify('lightsChanged', summary(model))
      edges.length
    end

    # One glow ribbon spreading from the edge into its face; a loose edge
    # glows to both sides.
    def self.led_ribbons(entities, view, edge, tr, width, mat)
      p1 = edge.start.position.transform(tr)
      p2 = edge.end.position.transform(tr)
      along = p2 - p1
      return if along.length < 1.mm
      along.normalize!
      mid = Geom.linear_combination(0.5, p1, 0.5, p2)

      face = best_face(edge, tr, mid, view)
      if face
        normal = facing_camera(world_normal(face, tr), mid, view)
        into = normal * along
        into.normalize!
        probe = mid.offset(into, [width / 10.0, 5.mm].min).transform(tr.inverse)
        inside = [Sketchup::Face::PointInside, Sketchup::Face::PointOnEdge].include?(face.classify_point(probe))
        into.reverse! unless inside
        ribbon(entities, p1, p2, normal, into, width, mat)
      else
        to_eye = view.camera.eye - mid
        normal = (along * to_eye) * along
        normal = view.camera.direction.reverse if normal.length < 1e-6
        normal.normalize!
        into = normal * along
        into.normalize!
        ribbon(entities, p1, p2, normal, into, width / 2.0, mat)
        ribbon(entities, p1, p2, normal, into.reverse, width / 2.0, mat)
      end
    end

    def self.best_face(edge, tr, mid, view)
      to_eye = view.camera.eye - mid
      to_eye.normalize! if to_eye.length > 0
      edge.faces.max_by do |f|
        n = world_normal(f, tr)
        (n % to_eye).abs
      end
    end

    def self.ribbon(entities, p1, p2, normal, into, width, mat)
      a = p1.offset(normal, LIFT.mm)
      b = p2.offset(normal, LIFT.mm)
      c = b.offset(into, width)
      d = a.offset(into, width)
      f = entities.add_face(a, b, c, d)
      return unless f
      f.position_material(mat, [a, [0, 1], b, [1, 1], c, [1, 0]], true)
      finish_face(f, normal)
    end

    # ---------- managing ----------

    def self.groups(model)
      model.entities.grep(Sketchup::Group).select { |g| g.valid? && g.get_attribute(DICT, 'type') }
    end

    def self.summary(model)
      out = { 'spots' => 0, 'leds' => 0, 'mirrors' => 0, 'kelvin' => [], 'visible' => true }
      return out unless model
      layer = model.layers[TAG]
      out['visible'] = layer ? layer.visible? : true
      groups(model).each do |g|
        next unless g.visible?
        type = g.get_attribute(DICT, 'type')
        key = "#{type}s"
        out[key] += 1 if out.key?(key)
        k = g.get_attribute(DICT, 'kelvin').to_i
        out['kelvin'] << k if k > 0 && type != 'mirror'
      end
      out['kelvin'] = out['kelvin'].uniq.sort
      out
    end

    def self.toggle(model)
      layer = tag(model)
      model.start_operation('Toggle AI lights', true)
      layer.visible = !layer.visible?
      model.commit_operation
      summary(model)
    end

    def self.remove_selected(model)
      picked = model.selection.grep(Sketchup::Group).select { |g| g.get_attribute(DICT, 'type') }
      raise 'Select the AI lights or mirrors to remove first.' if picked.empty?
      model.start_operation('Remove AI lights', true)
      model.entities.erase_entities(picked)
      model.commit_operation
      summary(model)
    end
  end
end
