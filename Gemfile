source "http://rubygems.org"

gem "haml",               "~> 4.0.0"

# Adds Hash.from_xml method used in Energy2D importer
gem 'activesupport',     "~> 3"
gem 'i18n',               "~> 0.6.4"
gem "gitlab-grit",        "~> 2.6.0"
gem "shutterbug",         "~> 0.2.1"
gem "s3_website",         "~> 1.7.6"

group :app do
  gem "rack",               "~> 1.5.2"
  gem "rake",               "~> 10.1.0"
  gem "sass",               "~> 3.2.5"
  gem 'bourbon',            "~> 3.1.1"
  gem 'neat',               "~> 1.2.0"
  gem 'kramdown',           "~> 1.3.0"
  gem "mustache",           "~> 0.99.4"
end

def darwin_only(require_as)
  RbConfig::CONFIG['host_os'] =~ /darwin/ && require_as
end

def linux_only(require_as)
  RbConfig::CONFIG['host_os'] =~ /linux/ && require_as
end

def windows_only(require_as)
  RbConfig::CONFIG['host_os'] =~ /mingw|mswin/i && require_as
end

group :development do
  gem "fog",                "~> 1.12.1"
  gem "rack-livereload",    "~> 0.3.15"
  gem "rack-nocache",       "~> 0.1.0"

  # http://about.travis-ci.org/docs/user/travis-lint/
  gem "travis-lint"

  # guard related ...
  gem "guard",              "~> 1.8.2"
  gem "guard-haml",         "~> 0.4"
  gem "guard-sass",         "~> 1.3.2"
  gem "guard-shell",        "~> 0.5.1"
  gem "guard-livereload",   "~> 1.4.0"
  gem 'guard-coffeescript', "~> 1.3.2"
  # FS Notification libraries for guard (non-polling)
  gem 'rb-fsevent', "~> 0.9.3", :require => darwin_only('rb-fsevent')
  gem 'rb-inotify', "~> 0.9.0", :require => linux_only('rb-inotify')
  gem 'wdm',        "~> 0.1.0", :require => windows_only('wdm')
  # Growl Notification Transport Protocol (used by guard)
  gem 'ruby_gntp',  "~> 0.3.4"
end
