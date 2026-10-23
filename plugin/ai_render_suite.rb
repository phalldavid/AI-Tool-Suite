# David Render Studio for SketchUp
# Sends the current view and a prompt to the user's own Gemini key or a
# local ComfyUI server, and brings the render back into SketchUp.

require 'sketchup.rb'
require 'extensions.rb'

module AIRenderSuite
  PLUGIN_ID = File.basename(__FILE__, '.rb')
  PLUGIN_DIR = File.join(File.dirname(__FILE__), PLUGIN_ID)
  VERSION = '0.1.0'.freeze

  unless file_loaded?(__FILE__)
    ex = SketchupExtension.new('David Render Studio', File.join(PLUGIN_DIR, 'main'))
    ex.description = 'AI renders from the SketchUp view using your own Gemini key or local ComfyUI.'
    ex.version = VERSION
    ex.creator = 'David Render Studio'
    Sketchup.register_extension(ex, true)
    file_loaded(__FILE__)
  end
end
