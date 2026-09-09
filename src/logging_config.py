import logging

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_LEVEL = logging.INFO

logging.basicConfig(format=LOG_FORMAT, level=LOG_LEVEL)

# Usage: import logging; logger = logging.getLogger(__name__)
