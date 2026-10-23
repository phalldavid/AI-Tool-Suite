require 'json'
require 'fileutils'

module AIRenderSuite
  # Handles requests from the panel. Each request carries an id; the answer
  # goes back through window.AIRS.receive with the same id.
  module Bridge
    # Returned by a request that answers later (the browser render).
    DEFERRED = Object.new.freeze

    def self.handle(dialog, json)
      req = JSON.parse(json)
      id = req['id']
      begin
        result = dispatch(req['action'], req['payload'] || {}, id)
        reply(dialog, 'id' => id, 'ok' => true, 'result' => result) unless result.equal?(DEFERRED)
      rescue StandardError => e
        reply(dialog, 'id' => id, 'ok' => false, 'error' => e.message)
      end
    end

    def self.dispatch(action, payload, id = nil)
      case action
      when 'capture' then Capture.run(payload)
      when 'save' then save(payload)
      when 'getSetting' then Store.get(payload['key'])
      when 'setSetting' then Store.set(payload['key'], payload['value']) && nil
      when 'openFolder' then open_folder
      when 'setFrame' then Frame.set(payload['ratio'], payload['visible'])
      when 'placeSpots' then Lights.start_spot_tool(payload['settings'], payload['texture'])
      when 'addLeds' then Lights.add_leds(payload['settings'], payload['texture'])
      when 'lightsSummary' then Lights.summary(Sketchup.active_model)
      when 'toggleLights' then Lights.toggle(Sketchup.active_model)
      when 'removeSelectedLights' then Lights.remove_selected(Sketchup.active_model)
      when 'pickMirror' then Mirror.start_pick_tool(payload['settings'] || {})
      when 'refreshMirrors' then Mirror.refresh_all
      when 'browserOpen' then Browser.open(payload['site'].to_s)
      when 'browserRender' then Browser.render(payload, id)
      when 'browserGrab' then Browser.grab
      when 'browserCancel' then Browser.cancel
      else raise "Unknown request: #{action}"
      end
    end

    # Pushes an unrequested event to the panel, e.g. after a light is placed.
    def self.notify(name, payload)
      d = AIRenderSuite.open_dialog
      return unless d
      d.execute_script("window.AIRS && window.AIRS.event && window.AIRS.event(#{JSON.generate(name)}, #{JSON.generate(payload)})")
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
