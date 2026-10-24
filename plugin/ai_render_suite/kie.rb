require 'json'
require 'net/http'
require 'uri'

module AIRenderSuite
  # Network calls for the Kie.ai backend. The panel sends them here because
  # Kie's servers may refuse calls made straight from a web page. JSON calls
  # use SketchUp's own HTTP client, which does not freeze SketchUp while it
  # waits; the reply goes back to the panel when the answer arrives.
  module Kie
    HOSTS = %w[api.kie.ai kieai.redpandaai.co].freeze

    # Keeps requests alive until they finish (SketchUp drops them otherwise).
    @live = []

    def self.check_url(url, hosts = HOSTS)
      uri = URI.parse(url.to_s)
      raise 'Only https links are allowed.' unless uri.is_a?(URI::HTTPS)
      raise "Not a Kie.ai address: #{uri.host}" if hosts && !hosts.include?(uri.host)
      uri
    end

    # payload: { method, url, key, body }. Replies { status, body }.
    def self.http(payload, request_id)
      uri = check_url(payload['url'])
      method = payload['method'] == 'POST' ? Sketchup::Http::POST : Sketchup::Http::GET
      req = Sketchup::Http::Request.new(uri.to_s, method)
      headers = { 'Authorization' => "Bearer #{payload['key']}", 'Accept' => 'application/json' }
      unless payload['body'].nil?
        headers['Content-Type'] = 'application/json'
        req.body = JSON.generate(payload['body'])
      end
      req.headers = headers
      @live << req
      req.start do |r, res|
        @live.delete(r)
        body = begin
          JSON.parse(res.body.to_s)
        rescue JSON::ParserError
          nil
        end
        answer('ok' => true, 'result' => { 'status' => res.status_code, 'body' => body }, 'id' => request_id)
      end
      Bridge::DEFERRED
    end

    # Downloads a finished render. Any https host: Kie serves results from
    # several file servers.
    def self.download(payload, limit = 4)
      uri = check_url(payload['url'], nil)
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 20, read_timeout: 120) do |h|
        h.request(Net::HTTP::Get.new(uri))
      end
      if res.is_a?(Net::HTTPRedirection) && limit > 0
        return download({ 'url' => URI.join(uri.to_s, res['location']).to_s }, limit - 1)
      end
      raise "Could not download the render (error #{res.code})." unless res.is_a?(Net::HTTPSuccess)
      type = res['content-type'].to_s.split(';').first.to_s
      type = res.body.to_s.start_with?("\xFF\xD8".b) ? 'image/jpeg' : 'image/png' unless type.start_with?('image/')
      { 'mimeType' => type, 'data' => [res.body.to_s].pack('m0') }
    end

    def self.answer(message)
      main = AIRenderSuite.open_dialog
      Bridge.reply(main, message) if main
    end
  end
end
