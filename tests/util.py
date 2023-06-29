from typing import Callable, List, Optional
import time


def raise_multiple(errors: List) -> None:
    """
    Raise a stack of errors.
    """
    if len(errors) == 0: return

    try: raise errors.pop()
    finally: raise_multiple(errors)


def repeat_test(attempts: int, after: int, errors: Optional[List[Exception]] = None) -> Callable:
    """
    Decorator to repeat a test N times for specific errors.

    :param attempts: Number of attempts for testing
    :param after: Time in seconds to wait for each attempt
    :param errors: If None, repeat test for any error
    """
    def _repeat_test(test_function: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            nonlocal attempts, errors

            error_list: List[Exception] = list()

            for attempt in range(attempts):
                try:
                    return test_function(*args, **kwargs)

                except Exception as error:
                    if errors is not None and error not in errors: raise error
                    if after is not None: time.sleep(after)

                    error_list.append(error)

            raise raise_multiple(error_list)
        return wrapper
    return _repeat_test
