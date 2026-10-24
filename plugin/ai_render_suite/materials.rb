module AIRenderSuite
  # Lists the materials you can actually see in the current view, read
  # straight from the model: no AI, no cost, instant. Rays are cast through
  # a grid of points inside the render frame; each hit face reports its
  # material (or the one it inherits from its group or component), which way
  # it faces and what object it belongs to. The panel turns this into
  # Material Scan tags.
  module Materials
    COLS = 32
    ROWS = 20

    def self.in_view(payload = {})
      model = Sketchup.active_model
      raise 'Open a model first.' unless model
      view = model.active_view
      ratio = payload['ratio'].to_f
      fx, fy, fw, fh = Frame.rect(view.vpwidth, view.vpheight, ratio > 0 ? ratio : nil)
      eye_z = view.camera.eye.z
      hits = Hash.new { |h, k| h[k] = { 'count' => 0 } }
      total = 0
      ROWS.times do |r|
        COLS.times do |c|
          x = fx + fw * (c + 0.5) / COLS
          y = fy + fh * (r + 0.5) / ROWS
          total += 1
          hit = model.raytest(view.pickray(x.round, y.round))
          next unless hit
          point, path = hit
          face = path.last
          next unless face.is_a?(Sketchup::Face)
          next if path.any? { |e| e.respond_to?(:layer) && e.layer && e.layer.name == Lights::TAG }
          info = describe(face, path, point, view.camera.direction, eye_z)
          next unless info
          key = [info['name'], info['object'], info['facing']].join('|')
          entry = hits[key]
          entry.merge!(info) if entry['count'].zero?
          entry['count'] += 1
        end
      end
      list = hits.values.map do |e|
        e['coverage'] = (100.0 * e.delete('count') / total).round(1)
        e
      end
      list.sort_by { |e| -e['coverage'] }.first(40)
    end

    def self.describe(face, path, point, ray_dir, eye_z)
      t = Geom::Transformation.new
      path[0...-1].each { |e| t *= e.transformation if e.respond_to?(:transformation) }
      normal = face.normal.transform(t)
      normal.normalize! if normal.length > 0
      back = normal.dot(ray_dir) > 0
      mat = back ? face.back_material : face.material
      # Unpainted faces take the material of the nearest painted group or component.
      if mat.nil?
        path[0...-1].reverse_each do |e|
          next unless e.respond_to?(:material) && e.material
          mat = e.material
          break
        end
      end
      return nil if mat && mat.name.start_with?('AIRS Mirror')
      facing_z = back ? -normal.z : normal.z
      facing = if facing_z > 0.7 then 'up'
               elsif facing_z < -0.7 then 'down'
               else 'side'
               end
      {
        'name' => mat ? mat.display_name.to_s : '',
        'color' => mat ? hex(mat.color) : nil,
        'alpha' => mat ? mat.alpha.to_f.round(2) : 1.0,
        'texture' => mat && mat.texture ? File.basename(mat.texture.filename.to_s) : nil,
        'object' => object_name(path),
        'facing' => facing,
        'aboveEye' => point.z > eye_z
      }
    end

    # The innermost named group or component the face belongs to.
    def self.object_name(path)
      path[0...-1].reverse_each do |e|
        if e.is_a?(Sketchup::ComponentInstance)
          name = e.name.to_s.empty? ? e.definition.name.to_s : e.name.to_s
          return name unless name.empty?
        elsif e.is_a?(Sketchup::Group)
          return e.name.to_s unless e.name.to_s.empty?
        end
      end
      nil
    end

    def self.hex(color)
      format('#%02x%02x%02x', color.red, color.green, color.blue)
    end
  end
end
