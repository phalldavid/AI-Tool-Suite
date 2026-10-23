require 'json'
require 'fileutils'

module AIRenderSuite
  # Settings for the panel, kept as one JSON file in the user's app data
  # folder. Plain text: the API key is readable by anyone using this account.
  module Store
    def self.folder
      base = ENV['APPDATA'] || File.join(Dir.home, 'Library', 'Application Support')
      File.join(base, 'AIRenderSuite')
    end

    def self.path
      File.join(folder, 'settings.json')
    end

    def self.all
      return {} unless File.exist?(path)
      JSON.parse(File.read(path, encoding: 'UTF-8'))
    rescue JSON::ParserError
      {}
    end

    def self.get(key)
      all[key.to_s]
    end

    def self.set(key, value)
      data = all
      data[key.to_s] = value
      FileUtils.mkdir_p(folder)
      tmp = "#{path}.tmp"
      File.write(tmp, JSON.generate(data), encoding: 'UTF-8')
      File.rename(tmp, path)
    end
  end
end
