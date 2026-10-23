require 'json'
require 'fileutils'
require 'tmpdir'

module AIRenderSuite
  # A browser window inside SketchUp that opens Gemini, ChatGPT or Google Flow
  # with the user's own login. On Render it drops the captured image and the
  # compiled prompt into the chat box (browser_agent.js does the page work).
  # The user presses Send on the site, then "Bring result back", and the
  # finished image comes back to the panel's history.
  module Browser
    SITES = {
      'gemini' => 'https://gemini.google.com/app',
      'chatgpt' => 'https://chatgpt.com/',
      'flow' => 'https://labs.google/fx/tools/flow'
    }.freeze

    class << self
      attr_reader :site
    end

    def self.dialog
      @dialog ||= create_dialog
    end

    def self.create_dialog
      d = UI::HtmlDialog.new(
        dialog_title: 'AI Render Suite - Browser',
        preferences_key: 'AIRenderSuite.browser',
        scrollable: true,
        resizable: true,
        width: 1100,
        height: 860,
        min_width: 600,
        min_height: 480,
        style: UI::HtmlDialog::STYLE_WINDOW
      )
      # The page calls this from browser_agent.js. It is the only way back.
      d.add_action_callback('airsBrowser') { |_ctx, json| on_agent(json) }
      d.set_on_closed do
        @dialog = nil
        @site = nil
        fail_pending('The browser window was closed.')
        Bridge.notify('browserVisible', false)
      end
      d
    end

    # Opens (or brings forward) the browser on a site.
    def self.open(site)
      url = SITES[site] || SITES['gemini']
      if @site != site || !dialog.visible?
        dialog.set_url(url)
        @site = site
        @loaded_at = Time.now
      end
      if dialog.visible?
        dialog.bring_to_front
      else
        dialog.show
        # Dock once the window exists, so the OS has placed it first.
        UI.start_timer(0.15, false) { dock }
      end
      Bridge.notify('browserVisible', true)
      nil
    end

    # Opens the browser beside the panel, or closes it if it is open.
    # Returns true when it is now open.
    def self.toggle(site)
      if @dialog && @dialog.visible?
        @dialog.close
        return false
      end
      open(site)
      true
    end

    # Chat sites refuse to load inside another page (they block framing),
    # so the browser cannot live inside the panel itself. Instead it is a
    # window snapped to the panel's left edge at the same height.
    def self.dock
      main = AIRenderSuite.open_dialog
      return unless main && @dialog && main.respond_to?(:get_position) && main.respond_to?(:get_size)
      x, y = main.get_position
      _w, h = main.get_size
      width = [[x, 1100].min, 640].max
      @dialog.set_position([x - width, 0].max, y)
      @dialog.set_size(width, h)
    rescue StandardError
      nil # older SketchUp: leave the window where the OS put it
    end

    # Starts a render. The reply to the panel is sent later, when the result
    # comes back, so the request id is kept until then.
    def self.render(payload, request_id)
      fail_pending('A new render was started.')
      site = payload['site'].to_s
      @pending = { id: request_id }
      @last_images = write_images(payload['images'] || [])
      fresh = @site != site || !(@dialog && @dialog.visible?)
      open(site)
      # A freshly opened page needs a moment before its chat box exists; the
      # agent itself also waits for the box.
      UI.start_timer(fresh ? 2.5 : 0.1, false) do
        run_agent('fill', 'site' => site, 'prompt' => payload['prompt'].to_s,
                          'images' => payload['images'] || [])
      end
      Bridge::DEFERRED
    end

    # Pulls the newest generated image off the page now.
    def self.grab
      raise 'Open the browser first.' unless @dialog && @dialog.visible?
      run_agent('grab', {})
      nil
    end

    def self.cancel
      run_agent('stop', {}) if @dialog && @dialog.visible?
      fail_pending('Cancelled.')
      nil
    end

    def self.agent_source
      @agent_source ||= File.read(File.join(PLUGIN_DIR, 'browser_agent.js'))
    end

    def self.run_agent(command, data)
      return unless @dialog
      @dialog.execute_script("#{agent_source}\n;window.__airsAgent && window.__airsAgent.run(#{JSON.generate(command)}, #{JSON.generate(data)});")
    end

    def self.on_agent(json)
      msg = JSON.parse(json.to_s)
      case msg['type']
      when 'status'
        Bridge.notify('browserStatus', 'text' => msg['text'].to_s, 'kind' => msg['kind'].to_s)
      when 'noimage'
        copied = copy_image_to_clipboard(@last_images && @last_images.first)
        Bridge.notify('browserStatus',
                      'text' => copied ? 'The image could not be attached for you. It is on the clipboard: click the chat box and press Ctrl+V, then Send.' : 'The image could not be attached. Drag it in from the AI Renders folder, then Send.',
                      'kind' => 'error')
      when 'result'
        finish('ok' => true, 'result' => { 'mimeType' => msg['mimeType'], 'data' => msg['data'] })
      when 'failed'
        fail_pending(msg['text'].to_s)
      end
    rescue StandardError => e
      fail_pending(e.message)
    end

    def self.finish(message)
      main = AIRenderSuite.open_dialog
      if @pending
        Bridge.reply(main, message.merge('id' => @pending[:id])) if main
        @pending = nil
      elsif main && message['ok']
        # A result grabbed with no render waiting: hand it to the panel anyway.
        Bridge.notify('browserResult', message['result'])
      end
    end

    def self.fail_pending(text)
      return unless @pending
      finish('ok' => false, 'error' => text)
    end

    def self.write_images(images)
      dir = File.join(Dir.tmpdir, 'AIRenderSuite')
      FileUtils.mkdir_p(dir)
      images.each_with_index.map do |img, i|
        ext = img['mimeType'].to_s.include?('jpeg') ? 'jpg' : 'png'
        path = File.join(dir, "send_#{i + 1}.#{ext}")
        File.binwrite(path, img['data'].to_s.unpack1('m'))
        path
      end
    end

    # Fallback when the page will not take the file: put the image on the
    # system clipboard so the user can paste it.
    def self.copy_image_to_clipboard(path)
      return false unless path && File.exist?(path)
      if Sketchup.platform == :platform_win
        win = path.tr('/', '\\').gsub("'", "''")
        script = "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; " \
                 "$i=[System.Drawing.Image]::FromFile('#{win}'); [System.Windows.Forms.Clipboard]::SetImage($i); $i.Dispose()"
        system('powershell.exe', '-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-Command', script)
      else
        system('osascript', '-e', "set the clipboard to (read (POSIX file \"#{path}\") as «class PNGf»)")
      end
    rescue StandardError
      false
    end
  end
end
