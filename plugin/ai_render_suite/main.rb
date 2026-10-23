require 'json'
require_relative 'store'
require_relative 'capture'
require_relative 'bridge'
require_relative 'frame'
require_relative 'lights'
require_relative 'mirror'
require_relative 'browser'

module AIRenderSuite
  def self.dialog
    @dialog ||= create_dialog
  end

  # The panel if it has been opened, without creating it.
  def self.open_dialog
    @dialog if @dialog && @dialog.visible?
  end

  def self.create_dialog
    d = UI::HtmlDialog.new(
      dialog_title: 'David Render Studio',
      preferences_key: 'AIRenderSuite.panel',
      scrollable: true,
      resizable: true,
      width: 480,
      height: 900,
      min_width: 360,
      min_height: 480,
      style: UI::HtmlDialog::STYLE_DIALOG
    )
    d.set_file(File.join(PLUGIN_DIR, 'ui', 'index.html'))
    d.add_action_callback('request') { |_ctx, json| Bridge.handle(d, json) }
    d
  end

  def self.show_panel
    if dialog.visible?
      dialog.bring_to_front
    else
      dialog.show
    end
  end

  # Opens the panel and captures the current view in one click.
  def self.capture_now
    was_open = dialog.visible?
    show_panel
    delay = was_open ? 0.05 : 1.0 # give a fresh panel time to load
    UI.start_timer(delay, false) do
      dialog.execute_script('window.AIRSApp && window.AIRSApp.captureFromHost()')
    end
  end

  def self.icon(name)
    ext = Sketchup.platform == :platform_win ? 'svg' : 'png'
    File.join(PLUGIN_DIR, 'icons', "#{name}.#{ext}")
  end

  unless file_loaded?(__FILE__)
    menu = UI.menu('Extensions').add_submenu('David Render Studio')
    menu.add_item('Open panel') { show_panel }
    menu.add_item('Capture view and open panel') { capture_now }
    menu.add_separator
    Browser::SITES.each_key do |site|
      label = { 'gemini' => 'Gemini', 'chatgpt' => 'ChatGPT', 'flow' => 'Google Flow' }[site]
      menu.add_item("Open browser: #{label}") { Browser.open(site) }
    end

    open_cmd = UI::Command.new('David Render Studio') { show_panel }
    open_cmd.tooltip = 'David Render Studio'
    open_cmd.status_bar_text = 'Open the David Render Studio panel.'
    open_cmd.small_icon = open_cmd.large_icon = icon('panel')

    capture_cmd = UI::Command.new('Capture view for AI render') { capture_now }
    capture_cmd.tooltip = 'Capture view for AI render'
    capture_cmd.status_bar_text = 'Capture the current view and send it to the David Render Studio panel.'
    capture_cmd.small_icon = capture_cmd.large_icon = icon('capture')

    toolbar = UI::Toolbar.new('David Render Studio')
    toolbar.add_item(open_cmd)
    toolbar.add_item(capture_cmd)
    toolbar.restore

    Sketchup.add_observer(Frame::ModelWatcher.new)
    Frame.install(Sketchup.active_model)

    file_loaded(__FILE__)
  end
end
