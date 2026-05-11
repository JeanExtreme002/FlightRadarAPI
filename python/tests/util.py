from typing import Callable, List, Optional, Sequence, Type
import time


def raise_multiple(errors: List) -> None:
    """
    Raise a stack of errors.
    """
    if len(errors) == 0: return

    try: raise errors.pop()
    finally: raise_multiple(errors)


def repeat_test(attempts: int, after: int, errors: Optional[Sequence[Type[BaseException]]] = None) -> Callable:
    """
    Decorator to repeat a test N times for specific errors.

    :param attempts: Number of attempts for testing
    :param after: Time in seconds to wait for each attempt
    :param errors: Sequence of exception classes to retry on; if None, retry on any error
    """
    if errors is not None:
        invalid = [e for e in errors if not (isinstance(e, type) and issubclass(e, BaseException))]
        if invalid:
            raise TypeError(f"errors must contain exception classes, got: {invalid}")

    def _repeat_test(test_function: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            error_list: List[Exception] = list()

            for _ in range(attempts):
                try:
                    return test_function(*args, **kwargs)

                except Exception as error:
                    if errors is not None and not isinstance(error, tuple(errors)): raise error
                    if after is not None: time.sleep(after)

                    error_list.append(error)

            raise_multiple(error_list)
        return wrapper
    return _repeat_test
