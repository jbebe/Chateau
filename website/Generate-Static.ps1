ni -ItemType Directory wp-static -ErrorAction Ignore

php wp-cli.phar --path=wordpress wp2static options set selected_deployment_option folder
php wp-cli.phar --path=wordpress wp2static options set targetFolder ((Resolve-Path .\wp-static).Path)

php wp-cli.phar --path=wordpress wp2static generate