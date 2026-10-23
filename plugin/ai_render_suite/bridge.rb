require 'json'
require 'fileutils'

module AIRenderSuite
  # Handles requests from the panel. Each request carries an id; the answer
  # goes back through window.AIRS.receive with the same id.
  module Bridge
    def self.handle(dialog, json)
      req = JSON.parse(json)
      id = req['id']
      begin
        result = dispatch(req['action'], req['payload'] || {})
        reply(dialog, 'id' => id, 'ok' => true, 'result' => result)
      rescue StandardError => e
        reply(dialog, 'id' => id, 'ok' => false, 'error' => e.message)
      end
    end

    def self.dispatch(action, payload)
      case action
      when 'capture' then Capture.run(payload)
      when 'save' then save(payload)
      when 'getSetting' then Store.get(payload['key'])
      when 'setSetting' then Store.set(payload['key'], payload['value']) && nil
      when 'openFolder' then open_folder
      else raise "Unknown request: #{action}"
      end
    end

    def self.reply(dialog, message)
      dialog.execute_script("window.AIRS && window.AIRS.receive(#{JSON.generate(message)})")
    end

    # Saves into an "AI Renders" folder next to the .skp. For an unsaved
    # model, asks once for a folder.
    def self.render_folder(ask: true)
      model = Sketchup.active_model
      if model && !model.path.to_s.empty?
        return File.join(File.dirname(model.path), 'AI Renders')
      end
      @fallback_folder ||= (UI.select_directory(title: 'Where should AI renders be saved?') if ask)
      raise 'No folder chosen, so the render was not saved.' unless @fallback_folder
      @fallback_folder
    end

    def self.save(payload)
      folder = render_folder
      FileUtils.mkdir_p(folder)
      ext = payload['mimeType'].to_s.include?('jpeg') ? 'jpg' : 'png'
      base = payload['baseName'].to_s.gsub(/[^\w.\-]+/, '_')[0, 120]
      base = 'render' if base.empty?
      path = File.join(folder, "#{base}.#{ext}")
      n = 2
      while File.exist?(path)
        path = File.join(folder, "#{base}_#{n}.#{ext}")
        n += 1
      end
      File.binwrite(path, payload['data'].to_s.unpack1('m'))
      path
    end

    def self.open_folder
      folder = render_folder(ask: false)
      FileUtils.mkdir_p(folder)
      UI.openURL("file:///#{folder.tr('\\', '/')}")
      nil
    rescue RuntimeError
      raise 'Save a render first, or save the model, so there is a folder to open.'
    end
  end
end
